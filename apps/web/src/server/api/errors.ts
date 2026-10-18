import type { z } from 'zod';

// Formato padrão de erro de todas as APIs:
// { "error": { "code": "TRAIL_NOT_FOUND", "message": "...", "details": ... } }
export type ErrorBody = {
	error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
		this.name = 'ApiError';
	}

	toBody(): ErrorBody {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.details !== undefined && { details: this.details }),
			},
		};
	}

	toResponse(): Response {
		return Response.json(this.toBody(), { status: this.status });
	}
}

// Atalhos para os casos comuns. Para um código mais específico,
// use direto: new ApiError(404, 'TRAIL_NOT_FOUND', 'Trilha não encontrada.')
export const badRequest = (message = 'Requisição inválida.', details?: unknown) =>
	new ApiError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Autenticação necessária.') =>
	new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Acesso negado.') => new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Recurso não encontrado.') =>
	new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflito com o estado atual do recurso.', details?: unknown) =>
	new ApiError(409, 'CONFLICT', message, details);

export const internalError = () => new ApiError(500, 'INTERNAL_ERROR', 'Erro interno do servidor.');

export function validationError(error: z.ZodError): ApiError {
	const issues = error.issues.map((issue) => ({
		path: issue.path.map(String).join('.'),
		message: issue.message,
	}));
	return new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', { issues });
}
