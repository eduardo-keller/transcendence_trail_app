import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai';
import { askSchema } from '@/lib/validation/ai';
import { friendlyError } from '@/server/ai/errors';
import { languageModel } from '@/server/ai/model';
import { NOT_FOUND_TEXT, RAG_SYSTEM, ragPrompt } from '@/server/ai/rag/prompt';
import { retrieve } from '@/server/ai/rag/retrieve';
import type { AskUIMessage } from '@/server/ai/rag/types';
import { consumeAiQuota } from '@/server/ai/rate-limit';
import { parseBody, withHandler } from '@/server/api';
import { requireUser } from '@/server/auth/session';

// "Pergunte sobre as trilhas" (módulo 8): busca no corpus e responde com fontes numeradas, em streaming.
// Entrada: askSchema (src/lib/validation/ai.ts). Saída: o stream de UI do AI SDK (SSE), lido pelo useChat.
//
// Erros ANTES do stream viram status HTTP: 401, 400, 429 AI_RATE_LIMITED.
// Depois de começar (200), qualquer falha do provedor, inclusive no embedding da pergunta, vira a parte
// "error" com a mensagem de friendlyError: um 5xx apareceria no console do Chrome.
// Não guarda a pergunta nem a resposta: só o contador do rate limit.

const TIMEOUT_MS = 60_000;

export const POST = withHandler(async (request) => {
	const user = await requireUser();
	const input = await parseBody(request, askSchema);
	await consumeAiQuota(user.id);
	// Parar na tela fecha a conexão → request.signal aborta a busca e a geração
	const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);

	const stream = createUIMessageStream<AskUIMessage>({
		execute: async ({ writer }) => {
			writer.write({ type: 'start' });

			// 1. Busca: embedding da pergunta → trechos mais parecidos acima do limiar
			const { numbered, sources } = await retrieve(input.question, { abortSignal });
			// 2. As fontes vão primeiro: a tela mostra de onde a resposta vem enquanto o texto chega
			writer.write({ type: 'data-sources', data: sources });

			// 3. Nenhum trecho acima do limiar: "não encontrei", sem chamar o modelo
			if (numbered.length === 0) {
				writer.write({ type: 'text-start', id: 'nao-encontrei' });
				writer.write({ type: 'text-delta', id: 'nao-encontrei', delta: NOT_FOUND_TEXT });
				writer.write({ type: 'text-end', id: 'nao-encontrei' });
				writer.write({ type: 'finish' });
				return;
			}

			// 4. Resposta a partir dos trechos numerados
			const result = streamText({
				model: languageModel(),
				system: RAG_SYSTEM,
				prompt: ragPrompt({ question: input.question, numbered }),
				abortSignal,
				maxRetries: 1,
				onError: ({ error }) => console.error('[ai/ask] erro do provedor:', error),
				onAbort: () => console.info(`[ai/ask] cancelado (${request.signal.aborted ? 'o cliente desconectou' : 'timeout'})`),
			});
			writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, onError: friendlyError }));
		},
		// Falha antes da geração (ex.: o embedding da pergunta): também vira mensagem amigável
		onError: (error) => {
			if (!request.signal.aborted) console.error('[ai/ask] erro na busca:', error);
			return friendlyError(error);
		},
	});

	return createUIMessageStreamResponse({ stream });
});
