import type { GenericOAuthConfig } from 'better-auth/plugins';
import { readSecret } from './secrets';

// Provedores OAuth. Cada um só liga se as duas credenciais existirem.
// URL de retorno a registrar no provedor: <BETTER_AUTH_URL>/api/auth/callback/<id>

const github = { clientId: readSecret('github_client_id'), clientSecret: readSecret('github_client_secret') };
const intra = { clientId: readSecret('ft_client_id'), clientSecret: readSecret('ft_client_secret') };

export const githubProvider = github.clientId && github.clientSecret ? { github: github as Required<typeof github> } : {};

// A 42 não é provedor nativo do Better Auth: entra pelo plugin de OAuth genérico
type IntraMe = { id: number; email: string; login: string; usual_full_name?: string; displayname?: string; image?: { link?: string } };

export const intraProvider: GenericOAuthConfig[] =
	intra.clientId && intra.clientSecret
		? [
				{
					providerId: '42',
					clientId: intra.clientId,
					clientSecret: intra.clientSecret,
					authorizationUrl: 'https://api.intra.42.fr/oauth/authorize',
					tokenUrl: 'https://api.intra.42.fr/oauth/token',
					scopes: ['public'],
					// O perfil da intra não segue o padrão OpenID: mapeamos os campos à mão
					getUserInfo: async (tokens) => {
						const response = await fetch('https://api.intra.42.fr/v2/me', {
							headers: { Authorization: `Bearer ${tokens.accessToken}` },
						});
						if (!response.ok) return null;
						const me = (await response.json()) as IntraMe;
						return {
							id: String(me.id),
							email: me.email,
							// e-mail institucional, verificado pela 42
							emailVerified: true,
							name: me.usual_full_name || me.displayname || me.login,
							image: me.image?.link,
						};
					},
				},
			]
		: [];

export const OAUTH_PROVIDERS = [
	...(Object.keys(githubProvider).length ? [{ id: 'github', label: 'GitHub' }] : []),
	...(intraProvider.length ? [{ id: '42', label: '42' }] : []),
];
