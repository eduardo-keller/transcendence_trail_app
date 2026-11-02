import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

// Modelo falso (LLM_PROVIDER=mock), para desenvolver e testar sem chave e sem gastar cota.
// Devolve um texto fixo palavra por palavra, com atraso, para o streaming ficar visível na tela.
// Se a entrada tiver "[falha]", o stream quebra no meio, como se o provedor caísse.

export const MOCK_FAILURE_TRIGGER = '[falha]';

const MOCK_TEXT = `Modo de teste (LLM_PROVIDER=mock): este texto não vem do Gemini.

Antes de sair
- Confira a previsão do tempo e avise alguém sobre o seu roteiro.
- Combine um horário para estar de volta antes do pôr do sol.

O que levar
- Água (pelo menos 1 litro por pessoa), lanche e protetor solar.
- Capa de chuva, lanterna e um pequeno kit de primeiros socorros.

Na trilha
- Mantenha um ritmo em que dê para conversar e faça pausas curtas a cada hora.
- Se o tempo fechar ou alguém cansar, volte: a trilha continua lá.`;

// Palavras com o espaço seguinte, para o texto remontado ficar igual ao original
const PIECES = MOCK_TEXT.match(/\S+\s*/g) ?? [];

export function mockLanguageModel({ chunkDelayInMs = 40 }: { chunkDelayInMs?: number | null } = {}) {
	return new MockLanguageModelV4({
		doStream: async ({ prompt }) => {
			const fails = JSON.stringify(prompt).includes(MOCK_FAILURE_TRIGGER);
			const pieces = fails ? PIECES.slice(0, 8) : PIECES;
			const deltas = pieces.map((delta) => ({ type: 'text-delta' as const, id: 'mock', delta }));
			const end = fails
				? [{ type: 'error' as const, error: new Error('mock: provedor fora do ar') }]
				: [
						{ type: 'text-end' as const, id: 'mock' },
						{
							type: 'finish' as const,
							finishReason: { unified: 'stop' as const, raw: undefined },
							usage: {
								inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
								outputTokens: { total: pieces.length, text: pieces.length, reasoning: undefined },
							},
						},
					];
			return {
				stream: simulateReadableStream({
					chunks: [{ type: 'text-start' as const, id: 'mock' }, ...deltas, ...end],
					chunkDelayInMs,
				}),
			};
		},
	});
}
