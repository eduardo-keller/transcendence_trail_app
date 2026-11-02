// Erro do hook do AI SDK (useCompletion/useChat) → texto para a tela.
// - Falha do provedor: chega dentro do stream (parte "error") já com a mensagem amigável do servidor.
// - Erro HTTP antes do stream (400, 404, 429): o corpo é o JSON de ApiError, { error: { message } }.
// - Sem rede: o fetch falha com TypeError.

const GENERIC = 'Algo deu errado. Tente de novo.';

export function describeAiError(error: Error): string {
	if (error.name === 'AI_UIMessageStreamError') return error.message || GENERIC;
	if ('responseBody' in error && typeof error.responseBody === 'string') {
		try {
			const message = JSON.parse(error.responseBody)?.error?.message;
			if (typeof message === 'string') return message;
		} catch {
			// corpo que não é JSON (ex.: página de erro do nginx): cai na mensagem genérica
		}
		return GENERIC;
	}
	if (error instanceof TypeError) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
	return GENERIC;
}
