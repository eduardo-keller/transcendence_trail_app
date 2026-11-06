import { createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai';
import { planSchema } from '@/lib/validation/ai';
import { friendlyError } from '@/server/ai/errors';
import { languageModel } from '@/server/ai/model';
import { PLANNER_SYSTEM, plannerPrompt } from '@/server/ai/planner';
import { consumeAiQuota } from '@/server/ai/rate-limit';
import { parseBody, withHandler } from '@/server/api';
import { requireUser } from '@/server/auth/session';
import { getTrail } from '@/server/trails/service';

// Planejador de trilha (módulo 7): gera o plano em streaming.
// Entrada: planSchema (src/lib/validation/ai.ts). Saída: o stream de UI do AI SDK (SSE), lido pelo useCompletion.
//
// Erros ANTES do stream viram status HTTP: 401, 400, 404 TRAIL_NOT_FOUND, 429 AI_RATE_LIMITED.
// Erros DEPOIS (o Gemini caiu, cota do Google, timeout) chegam como uma parte "error" dentro do stream,
// com a mensagem de friendlyError: a resposta já começou com 200, e um 5xx apareceria no console do Chrome.

const TIMEOUT_MS = 60_000;

export const POST = withHandler(async (request) => {
	const user = await requireUser();
	const input = await parseBody(request, planSchema);
	// A trilha vem do banco (e respeita a visibilidade): o prompt nunca usa dados de trilha vindos do cliente
	const trail = await getTrail(input.trailId, user.id);
	await consumeAiQuota(user.id);

	const result = streamText({
		model: languageModel(),
		system: PLANNER_SYSTEM,
		prompt: plannerPrompt(trail, input),
		// Parar na tela fecha a conexão → request.signal aborta → o SDK cancela a chamada ao Gemini
		abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]),
		// 1 nova tentativa em 429/5xx do Google; mais que isso só faz o usuário esperar
		maxRetries: 1,
		onError: ({ error }) => console.error('[ai/plan] erro do provedor:', error),
		onAbort: () =>
			console.info(`[ai/plan] cancelado (${request.signal.aborted ? 'o cliente desconectou' : 'timeout'})`),
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({ stream: result.stream, onError: friendlyError }),
	});
});
