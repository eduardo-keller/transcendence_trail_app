import type { z } from 'zod';
import { badRequest, validationError } from './errors';

export function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
	const result = schema.safeParse(data);
	if (!result.success) throw validationError(result.error);
	return result.data;
}

export async function parseBody<T extends z.ZodType>(
	request: Request,
	schema: T,
): Promise<z.output<T>> {
	let data: unknown;
	try {
		data = await request.json();
	} catch {
		throw badRequest('O corpo da requisição não é um JSON válido.');
	}
	return parseWith(schema, data);
}

// Valores vêm como string: use z.coerce para números e datas.
// Chaves repetidas (?tag=a&tag=b) viram array; parâmetro vazio (?q=) conta como ausente.
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.output<T> {
	const params = new URL(request.url).searchParams;
	const query: Record<string, string | string[]> = {};
	for (const key of new Set(params.keys())) {
		const values = params.getAll(key).filter((value) => value !== '');
		if (values.length > 0) query[key] = values.length > 1 ? values : values[0];
	}
	return parseWith(schema, query);
}

// Para os segmentos dinâmicos: parseParams(context.params, z.object({ id: z.string() }))
export async function parseParams<T extends z.ZodType>(
	params: Promise<unknown> | unknown,
	schema: T,
): Promise<z.output<T>> {
	return parseWith(schema, await params);
}
