import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	ApiError,
	conflict,
	notFound,
	paginate,
	paginated,
	paginationSchema,
	parseBody,
	parseParams,
	parseQuery,
	parseWith,
	unauthorized,
	validationError,
	withAction,
	withHandler,
} from '@/server/api';

const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('erro', { code, clientVersion: 'teste' });

// Captura o erro lançado por uma função (síncrona ou não)
async function caught(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (error) {
		return error;
	}
	throw new Error('esperava um erro');
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ApiError', () => {
	it('gera o corpo padrão e omite details quando não há', () => {
		expect(notFound().toBody()).toEqual({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
		expect(conflict('Duplicado', { fields: ['email'] }).toBody()).toEqual({
			error: { code: 'CONFLICT', message: 'Duplicado', details: { fields: ['email'] } },
		});
	});

	it('vira uma Response com o status certo', async () => {
		const response = new ApiError(404, 'TRAIL_NOT_FOUND', 'Trilha não encontrada.').toResponse();
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: { code: 'TRAIL_NOT_FOUND', message: 'Trilha não encontrada.' } });
	});

	it('validationError lista o caminho e o motivo de cada campo', () => {
		const result = z.object({ a: z.object({ b: z.number() }) }).safeParse({ a: { b: 'x' } });
		if (result.success) throw new Error('deveria falhar');
		const error = validationError(result.error);
		expect(error.status).toBe(400);
		expect(error.details).toEqual({ issues: [{ path: 'a.b', message: expect.any(String) }] });
	});
});

describe('parseQuery', () => {
	const schema = z.object({ tag: z.array(z.string()).optional(), q: z.string().optional(), n: z.coerce.number().optional() });

	it('chave repetida vira array; parâmetro vazio é ignorado', () => {
		const query = parseQuery(new Request('http://x/?tag=a&tag=b&q=&n=3'), schema);
		expect(query).toEqual({ tag: ['a', 'b'], n: 3 });
	});

	it('lança VALIDATION_ERROR com o campo errado', async () => {
		const error = await caught(() => parseQuery(new Request('http://x/?n=abc'), schema));
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBe('VALIDATION_ERROR');
		expect((error as ApiError).details).toMatchObject({ issues: [{ path: 'n' }] });
	});
});

describe('parseBody', () => {
	const schema = z.object({ nome: z.string().min(3) });
	const post = (body: string) => new Request('http://x/', { method: 'POST', body });

	it('valida o JSON do corpo', async () => {
		expect(await parseBody(post('{"nome":"Ana Maria"}'), schema)).toEqual({ nome: 'Ana Maria' });
	});

	it('corpo que não é JSON → BAD_REQUEST', async () => {
		const error = (await caught(() => parseBody(post('nao e json'), schema))) as ApiError;
		expect(error.code).toBe('BAD_REQUEST');
	});

	it('JSON fora do schema → VALIDATION_ERROR', async () => {
		const error = (await caught(() => parseBody(post('{"nome":"ab"}'), schema))) as ApiError;
		expect(error.code).toBe('VALIDATION_ERROR');
	});
});

describe('parseParams e parseWith', () => {
	it('valida os params (que no Next chegam como Promise)', async () => {
		const schema = z.object({ id: z.string().min(1) });
		expect(await parseParams(Promise.resolve({ id: 'abc' }), schema)).toEqual({ id: 'abc' });
		expect(((await caught(() => parseParams(Promise.resolve({ id: '' }), schema))) as ApiError).status).toBe(400);
	});

	it('parseWith devolve o valor já convertido', () => {
		expect(parseWith(z.coerce.number(), '42')).toBe(42);
	});
});

describe('paginação', () => {
	it('padrões e limite de 50', () => {
		expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
		expect(paginationSchema.safeParse({ pageSize: 51 }).success).toBe(false);
	});

	it('paginate converte página em skip/take', () => {
		expect(paginate({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
		expect(paginate({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
	});

	it('paginated monta { items, page, pageSize, total }', () => {
		expect(paginated(['a'], 41, { page: 3, pageSize: 20 })).toEqual({ items: ['a'], page: 3, pageSize: 20, total: 41 });
	});
});

describe('withHandler', () => {
	const respond = async (error: unknown) => {
		const handler = withHandler(async () => {
			throw error;
		});
		const response = await handler(new Request('http://x/'), undefined);
		return { status: response.status, body: await response.json() };
	};

	it('devolve a resposta do handler quando dá certo', async () => {
		const handler = withHandler(async () => Response.json({ ok: true }));
		expect(await (await handler(new Request('http://x/'), undefined)).json()).toEqual({ ok: true });
	});

	it('ApiError → status e código dele', async () => {
		expect(await respond(unauthorized())).toEqual({
			status: 401,
			body: { error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } },
		});
	});

	it('ZodError lançado direto → 400 VALIDATION_ERROR', async () => {
		const zodError = z.number().safeParse('x').error;
		expect((await respond(zodError)).body.error.code).toBe('VALIDATION_ERROR');
	});

	it('Prisma P2002 (unique) → 409, P2025 (não existe) → 404 e P2003 (chave estrangeira) → 409', async () => {
		expect((await respond(prismaError('P2002'))).status).toBe(409);
		expect((await respond(prismaError('P2025'))).status).toBe(404);
		expect((await respond(prismaError('P2003'))).status).toBe(409);
	});

	it('erro inesperado → 500 genérico, sem vazar a mensagem (que vai para o log)', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { status, body } = await respond(new Error('senha do banco: hunter2'));
		expect(status).toBe(500);
		expect(JSON.stringify(body)).not.toContain('hunter2');
		expect(log).toHaveBeenCalled();
	});

	it('deixa passar o redirect() do Next', async () => {
		const handler = withHandler(async () => redirect('/login'));
		const error = await caught(() => handler(new Request('http://x/'), undefined));
		expect(String((error as { digest?: string }).digest)).toContain('NEXT_REDIRECT');
	});
});

describe('withAction', () => {
	it('sucesso → { ok: true, data }', async () => {
		const action = withAction(async (n: number) => n * 2);
		expect(await action(21)).toEqual({ ok: true, data: 42 });
	});

	it('erro → { ok: false, error } no formato padrão, sem lançar', async () => {
		const action = withAction(async () => {
			throw new ApiError(403, 'TRAIL_NOT_EDITABLE', 'Não pode.');
		});
		expect(await action()).toEqual({ ok: false, error: { code: 'TRAIL_NOT_EDITABLE', message: 'Não pode.' } });
	});

	it('deixa passar o redirect() do Next', async () => {
		const action = withAction(async () => redirect('/'));
		await expect(action()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
	});
});
