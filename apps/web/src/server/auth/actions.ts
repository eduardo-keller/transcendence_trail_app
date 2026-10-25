'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
	type ChangePasswordInput,
	changePasswordSchema,
	type SignInInput,
	type SignUpInput,
	signInSchema,
	signUpSchema,
} from '@/lib/validation/auth';
import { ApiError, internalError, parseWith, withAction } from '@/server/api';
import { callAuth } from './http';
import { getSession, requireUser } from './session';
import { revokeOtherSessions, revokeSession } from './sessions';

const tooManyRequests = () => new ApiError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Espere 1 minuto e tente de novo.');

export const signInAction = withAction(async (input: SignInInput) => {
	const body = parseWith(signInSchema, input);
	const { status, data } = await callAuth('/sign-in/email', body);
	if (status === 429) throw tooManyRequests();
	// Mesma mensagem para e-mail inexistente e senha errada
	if (status === 401 || status === 400) throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
	if (status !== 200) throw internalError();
	// Senha certa, mas a conta tem 2FA: ainda falta o código do app
	if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) redirect('/login/2fa');
	redirect('/conta');
});

export const signUpAction = withAction(async (input: SignUpInput) => {
	const body = parseWith(signUpSchema, input);
	const { status } = await callAuth('/sign-up/email', body);
	if (status === 429) throw tooManyRequests();
	// Não confirma se o e-mail já tem conta
	if (status === 422 || status === 400) {
		throw new ApiError(400, 'SIGN_UP_FAILED', 'Não foi possível criar a conta com esses dados. Se você já tem conta, entre.');
	}
	if (status !== 200) throw internalError();
	redirect('/conta');
});

export const signOutAction = withAction(async () => {
	await callAuth('/sign-out');
	redirect('/login');
});

export const changePasswordAction = withAction(async (input: ChangePasswordInput) => {
	await requireUser();
	const { currentPassword, newPassword } = parseWith(changePasswordSchema, input);
	// revokeOtherSessions: quem estiver usando a conta em outro lugar é desconectado
	const { status, data } = await callAuth('/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
	if (status === 429) throw tooManyRequests();
	const code = (data as { code?: string } | null)?.code;
	if (code === 'INVALID_PASSWORD') throw new ApiError(400, 'INVALID_PASSWORD', 'Senha atual incorreta.');
	if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
		throw new ApiError(400, 'NO_PASSWORD', 'Sua conta entra pelo GitHub ou pela 42 e não tem senha.');
	}
	if (status !== 200) throw internalError();
	// A troca cria uma sessão nova (cookie novo) e a página é refeita: o aviso vai pela URL
	redirect('/conta?aviso=senha-trocada');
});

const sessionIdSchema = z.object({ id: z.string().min(1).max(64) });

export const revokeSessionAction = withAction(async (id: string) => {
	const user = await requireUser();
	await revokeSession(user.id, parseWith(sessionIdSchema, { id }).id);
	revalidatePath('/conta');
	return null;
});

export const revokeOtherSessionsAction = withAction(async () => {
	const session = await getSession();
	const user = await requireUser();
	await revokeOtherSessions(user.id, session?.session.id ?? '');
	revalidatePath('/conta');
	return null;
});
