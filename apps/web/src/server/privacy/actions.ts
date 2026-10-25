'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PASSWORD_MAX } from '@/lib/validation/auth';
import { ApiError, internalError, parseWith, withAction } from '@/server/api';
import { hasPassword } from '@/server/auth/account';
import { callAuth } from '@/server/auth/http';
import { requireUser } from '@/server/auth/session';

const schema = z.object({ password: z.string().max(PASSWORD_MAX).optional() });

// Passo 1 da exclusão: confere a senha e manda o link de confirmação por e-mail.
// Nada é apagado aqui; só quando a pessoa abre o link (passo 2, no Better Auth).
export const requestAccountDeletionAction = withAction(async (input: { password?: string }) => {
	const user = await requireUser();
	const { password } = parseWith(schema, input);
	if ((await hasPassword(user.id)) && !password) throw new ApiError(400, 'PASSWORD_REQUIRED', 'Digite a sua senha.');

	const { status, data } = await callAuth('/delete-user', { password: password || undefined, callbackURL: '/conta-excluida' });
	const code = (data as { code?: string } | null)?.code;
	if (code === 'INVALID_PASSWORD') throw new ApiError(400, 'INVALID_PASSWORD', 'Senha incorreta.');
	if (code === 'SESSION_EXPIRED' || status === 403) {
		throw new ApiError(403, 'SESSION_NOT_FRESH', 'Por segurança, saia e entre de novo antes de excluir a conta.');
	}
	if (status !== 200) throw internalError();
	// TODO(notify): "Excluir a conta" quando o notify() do Rafa existir (o e-mail já avisa)
	return { email: user.email };
});

const tokenSchema = z.object({ token: z.string().regex(/^[a-z0-9]{16,64}$/, 'Link inválido.') });

// Passo 2: o Better Auth confere que o token é desta pessoa logada, apaga o token (uso único) e a conta
export const confirmAccountDeletionAction = withAction(async (token: string) => {
	await requireUser();
	const { token: valid } = parseWith(tokenSchema, { token });
	const { status } = await callAuth(`/delete-user/callback?token=${valid}`, undefined, 'GET');
	if (status !== 200) throw new ApiError(400, 'INVALID_TOKEN', 'Link inválido, expirado ou já usado.');
	redirect('/conta-excluida');
});
