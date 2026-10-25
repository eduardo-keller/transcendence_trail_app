'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { OAUTH_PROVIDERS } from '@/lib/oauth';
import { internalError, parseWith, withAction } from '@/server/api';
import { callAuth } from './http';
import { requireUser } from './session';

const providerSchema = z.object({ provider: z.enum(OAUTH_PROVIDERS.map((p) => p.id) as [string, ...string[]]) });

// O Better Auth gera o state e o PKCE, guarda (cookie + banco) e devolve a URL do provedor
async function startOAuth(path: string, provider: string, callbackURL: string, errorCallbackURL: string) {
	const body = parseWith(providerSchema, { provider });
	const { status, data } = await callAuth(path, { ...body, callbackURL, errorCallbackURL });
	const url = (data as { url?: string } | null)?.url;
	if (status !== 200 || !url) throw internalError();
	redirect(url);
}

export const oauthSignInAction = withAction(async (provider: string) => {
	await startOAuth('/sign-in/social', provider, '/conta', '/login');
});

// Conectar outro provedor a uma conta já logada
export const linkAccountAction = withAction(async (provider: string) => {
	await requireUser();
	// TODO(notify): "Vincular conta OAuth" quando o notify() do Rafa existir
	await startOAuth('/link-social', provider, '/conta?aviso=conta-conectada', '/conta');
});
