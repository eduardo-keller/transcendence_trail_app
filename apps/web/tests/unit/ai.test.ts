import { APICallError, RetryError, streamText } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSecret } from '@/lib/secrets';
import { AI_ERROR_MESSAGES, AiNotConfiguredError, friendlyError } from '@/server/ai/errors';
import { MOCK_FAILURE_TRIGGER, mockLanguageModel } from '@/server/ai/mock';
import { DEFAULT_LLM_MODEL, isAiConfigured, languageModel } from '@/server/ai/model';

// O container de teste tem a chave real em /run/secrets: aqui ela é simulada
vi.mock('@/lib/secrets', () => ({ readSecret: vi.fn() }));
const mockedSecret = vi.mocked(readSecret);

afterEach(() => {
	vi.unstubAllEnvs();
	mockedSecret.mockReset();
});

const apiError = (statusCode: number) =>
	new APICallError({ message: 'erro do Google', url: 'https://example.com', requestBodyValues: {}, statusCode });

// Junta o texto do stream e o erro que o streamText entregou ao onError
async function run(model: ReturnType<typeof languageModel>, prompt: string) {
	let error: unknown;
	const result = streamText({
		model,
		prompt,
		maxRetries: 0,
		onError: (event) => {
			error = event.error;
		},
	});
	const pieces: string[] = [];
	for await (const piece of result.textStream) pieces.push(piece);
	return { pieces, text: pieces.join(''), error };
}

describe('friendlyError', () => {
	it('sem chave → "não está configurado"', () => {
		expect(friendlyError(new AiNotConfiguredError())).toBe(AI_ERROR_MESSAGES.notConfigured);
	});

	it('429 do Google → limite de uso, inclusive depois das novas tentativas do SDK', () => {
		expect(friendlyError(apiError(429))).toBe(AI_ERROR_MESSAGES.quota);
		const retried = new RetryError({ message: 'falhou 2x', reason: 'maxRetriesExceeded', errors: [apiError(429), apiError(429)] });
		expect(friendlyError(retried)).toBe(AI_ERROR_MESSAGES.quota);
	});

	it('timeout → "demorou demais"', () => {
		expect(friendlyError(new DOMException('tempo esgotado', 'TimeoutError'))).toBe(AI_ERROR_MESSAGES.timeout);
	});

	it('chave inválida, provedor fora e erro qualquer → "indisponível", sem detalhe técnico', () => {
		for (const error of [apiError(400), apiError(503), new Error('ECONNRESET'), 'texto']) {
			expect(friendlyError(error)).toBe(AI_ERROR_MESSAGES.unavailable);
		}
	});
});

describe('mockLanguageModel', () => {
	it('devolve o texto fixo em vários pedaços', async () => {
		const { pieces, text, error } = await run(mockLanguageModel({ chunkDelayInMs: null }), 'oi');
		expect(pieces.length).toBeGreaterThan(20);
		expect(text).toContain('LLM_PROVIDER=mock');
		expect(error).toBeUndefined();
	});

	it(`com "${MOCK_FAILURE_TRIGGER}" na entrada, o stream quebra no meio`, async () => {
		const { text, error } = await run(mockLanguageModel({ chunkDelayInMs: null }), `teste ${MOCK_FAILURE_TRIGGER}`);
		expect(text.length).toBeGreaterThan(0);
		expect(text).not.toContain('Na trilha');
		expect(friendlyError(error)).toBe(AI_ERROR_MESSAGES.unavailable);
	});
});

describe('languageModel', () => {
	it('LLM_PROVIDER=mock → modelo falso, mesmo sem chave', () => {
		vi.stubEnv('LLM_PROVIDER', 'mock');
		expect(languageModel()).toMatchObject({ provider: 'mock-provider' });
		expect(isAiConfigured()).toBe(true);
	});

	it('Gemini com o modelo de LLM_MODEL, ou o padrão', () => {
		vi.stubEnv('LLM_PROVIDER', 'gemini');
		vi.stubEnv('LLM_MODEL', 'gemini-3.6-flash');
		expect(languageModel()).toMatchObject({ modelId: 'gemini-3.6-flash' });
		vi.stubEnv('LLM_MODEL', '');
		expect(languageModel()).toMatchObject({ modelId: DEFAULT_LLM_MODEL });
	});

	it('Gemini sem chave: não chama a API e o erro vira "não está configurado"', async () => {
		vi.stubEnv('LLM_PROVIDER', 'gemini');
		mockedSecret.mockReturnValue(undefined);
		expect(isAiConfigured()).toBe(false);
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const { text, error } = await run(languageModel(), 'oi');
		expect(text).toBe('');
		expect(error).toBeInstanceOf(AiNotConfiguredError);
		expect(friendlyError(error)).toBe(AI_ERROR_MESSAGES.notConfigured);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
