import { APICallError, RetryError } from 'ai';

// Erros da IA → mensagem para a tela. O detalhe técnico fica no log do servidor, nunca vai para o usuário.

// Lançado quando o Gemini é chamado sem chave (docker/secrets/gemini_api_key.txt vazio)
export class AiNotConfiguredError extends Error {
	constructor() {
		super('Falta a chave do Gemini em docker/secrets/gemini_api_key.txt.');
		this.name = 'AiNotConfiguredError';
	}
}

export const AI_ERROR_MESSAGES = {
	notConfigured: 'O assistente não está configurado neste servidor.',
	quota: 'O assistente atingiu o limite de uso do provedor. Tente de novo em alguns minutos.',
	timeout: 'O assistente demorou demais para responder. Tente de novo.',
	unavailable: 'O assistente está indisponível agora. Tente de novo em alguns minutos.',
} as const;

export function friendlyError(error: unknown): string {
	// Erros que o SDK tentou de novo (429, 5xx) chegam embrulhados num RetryError
	const cause = RetryError.isInstance(error) ? error.lastError : error;

	if (cause instanceof AiNotConfiguredError) return AI_ERROR_MESSAGES.notConfigured;
	// 429 do Google: cota do projeto esgotada (por minuto ou por dia)
	if (APICallError.isInstance(cause) && cause.statusCode === 429) return AI_ERROR_MESSAGES.quota;
	// AbortSignal.timeout() estourou
	if (cause instanceof Error && cause.name === 'TimeoutError') return AI_ERROR_MESSAGES.timeout;
	// Chave inválida (400/403), modelo sobrecarregado (503), rede fora…
	return AI_ERROR_MESSAGES.unavailable;
}
