import { unstable_rethrow } from 'next/navigation';
import type { ErrorBody } from './errors';
import { toApiError } from './handler';

// Resultado de toda server action: o formulário olha `ok` e, se der erro, mostra
// error.message (ou error.details.issues ao lado de cada campo).
// Erros viram valor de retorno, não exceção: assim nada de 4xx/5xx aparece no console do navegador.
export type ActionResult<T> = { ok: true; data: T } | ({ ok: false } & ErrorBody);

// Envolve uma server action e converte qualquer erro lançado no ActionResult padrão.
//
//   'use server';
//   export const createTrailAction = withAction(async (input: CreateTrailInput) => { ... });
export function withAction<A extends unknown[], T>(action: (...args: A) => Promise<T>) {
	return async (...args: A): Promise<ActionResult<T>> => {
		try {
			return { ok: true, data: await action(...args) };
		} catch (error) {
			// Deixa passar redirect(), notFound() etc. do Next
			unstable_rethrow(error);
			return { ok: false, ...toApiError(error).toBody() };
		}
	};
}
