'use server';

import { redirect } from 'next/navigation';
import { type SignInInput, type SignUpInput, signInSchema, signUpSchema } from '@/lib/validation/auth';
import { ApiError, internalError, parseWith, withAction } from '@/server/api';
import { callAuth } from './http';

const tooManyRequests = () => new ApiError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Espere 1 minuto e tente de novo.');

export const signInAction = withAction(async (input: SignInInput) => {
	const body = parseWith(signInSchema, input);
	const { status } = await callAuth('/sign-in/email', body);
	if (status === 429) throw tooManyRequests();
	// Mesma mensagem para e-mail inexistente e senha errada
	if (status === 401 || status === 400) throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
	if (status !== 200) throw internalError();
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
