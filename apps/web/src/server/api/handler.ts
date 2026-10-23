import { Prisma } from '@prisma/client';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import { ApiError, conflict, internalError, notFound, validationError } from './errors';

type RouteHandler<C> = (request: Request, context: C) => Response | Promise<Response>;

// Envolve um route handler e converte qualquer erro lançado na resposta padrão.
//
//   export const GET = withHandler(async (request, { params }: { params: Promise<{ id: string }> }) => {
//     const { id } = await parseParams(params, idSchema);
//     ...
//   });
export function withHandler<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
	return async (request, context) => {
		try {
			return await handler(request, context);
		} catch (error) {
			// Deixa passar redirect(), notFound() etc. do Next
			unstable_rethrow(error);
			return toApiError(error).toResponse();
		}
	};
}

// Também usado por withAction: qualquer erro lançado vira um ApiError
export function toApiError(error: unknown): ApiError {
	if (error instanceof ApiError) return error;
	if (error instanceof ZodError) return validationError(error);
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		// Violação de @unique
		if (error.code === 'P2002') {
			const target = error.meta?.target;
			return conflict('Já existe um registro com estes dados.', target ? { fields: target } : undefined);
		}
		// update/delete de registro que não existe
		if (error.code === 'P2025') return notFound();
		if (error.code === 'P2003') return conflict('O registro relacionado não existe mais.');
	}
	console.error(error);
	return internalError();
}
