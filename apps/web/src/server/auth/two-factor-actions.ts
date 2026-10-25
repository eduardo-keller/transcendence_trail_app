'use server';

import { redirect } from 'next/navigation';
import { backupCodeSchema, passwordConfirmSchema, totpCodeSchema } from '@/lib/validation/auth';
import { ApiError, internalError, parseWith, withAction } from '@/server/api';
import { callAuth } from './http';
import { requireUser } from './session';

const tooManyRequests = () => new ApiError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Espere alguns segundos e tente de novo.');
const errorCode = (data: unknown) => (data as { code?: string } | null)?.code;

// Passo 1 da ativação: confere a senha e devolve o segredo e os códigos de recuperação.
// Ainda não ativa: só ativa depois que a pessoa digitar um código do app (passo 2).
export const startTwoFactorAction = withAction(async (input: { password: string }) => {
	await requireUser();
	const { status, data } = await callAuth('/two-factor/enable', parseWith(passwordConfirmSchema, input));
	if (status === 429) throw tooManyRequests();
	if (errorCode(data) === 'INVALID_PASSWORD') throw new ApiError(400, 'INVALID_PASSWORD', 'Senha incorreta.');
	if (status !== 200) throw internalError();
	const { totpURI, backupCodes } = data as { totpURI: string; backupCodes: string[] };
	return { uri: totpURI, secret: new URL(totpURI).searchParams.get('secret') ?? '', backupCodes };
});

const invalidCode = () => new ApiError(400, 'INVALID_CODE', 'Código inválido. Confira se o horário do celular está certo.');

// Passo 2: o primeiro código certo liga o 2FA (e o Better Auth renova o cookie de sessão)
export const confirmTwoFactorAction = withAction(async (input: { code: string }) => {
	await requireUser();
	const { status } = await callAuth('/two-factor/verify-totp', parseWith(totpCodeSchema, input));
	if (status === 429) throw tooManyRequests();
	if (status !== 200) throw invalidCode();
	// TODO(notify): "Ativar 2FA" quando o notify() do Rafa existir
	redirect('/conta?aviso=2fa-ativado');
});

export const disableTwoFactorAction = withAction(async (input: { password: string }) => {
	await requireUser();
	const { status, data } = await callAuth('/two-factor/disable', parseWith(passwordConfirmSchema, input));
	if (status === 429) throw tooManyRequests();
	if (errorCode(data) === 'INVALID_PASSWORD') throw new ApiError(400, 'INVALID_PASSWORD', 'Senha incorreta.');
	if (status !== 200) throw internalError();
	// TODO(notify): "Desativar 2FA" quando o notify() do Rafa existir
	redirect('/conta?aviso=2fa-desativado');
});

// No login: senha certa + 2FA ligado → o Better Auth guarda um cookie temporário e pede o código.
// Sem esse cookie (expirou ou ninguém passou pela senha), a verificação falha.
export const verifyLoginCodeAction = withAction(async (input: { code: string }) => {
	const { status } = await callAuth('/two-factor/verify-totp', parseWith(totpCodeSchema, input));
	if (status === 429) throw tooManyRequests();
	if (status !== 200) throw invalidCode();
	redirect('/conta');
});

export const verifyLoginBackupCodeAction = withAction(async (input: { code: string }) => {
	const { status } = await callAuth('/two-factor/verify-backup-code', parseWith(backupCodeSchema, input));
	if (status === 429) throw tooManyRequests();
	if (status !== 200) throw new ApiError(400, 'INVALID_CODE', 'Código de recuperação inválido ou já usado.');
	redirect('/conta');
});
