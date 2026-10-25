import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { fieldErrors, signUpSchema } from './validation/auth';
import { generateUsername } from './validation/profile';
import { prisma } from './db';

// BETTER_AUTH_SECRET e BETTER_AUTH_URL são lidos do ambiente pelo próprio Better Auth
// (o entrypoint do container exporta o segredo a partir do Docker secret).
export const auth = betterAuth({
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},
	// Campos nossos no User. input: false = o cliente não manda; o servidor preenche.
	user: {
		additionalFields: {
			username: { type: 'string', required: false, input: false },
			bio: { type: 'string', required: false, input: false },
		},
	},
	// Toda conta nova (e-mail ou OAuth) nasce com um username
	databaseHooks: {
		user: {
			create: {
				before: async (user) => ({
					data: { ...user, username: (user.username as string | undefined) ?? generateUsername(user.name) },
				}),
			},
		},
	},
	// Contado por IP e por rota. Sem isso ligado, dá para testar senhas sem limite.
	rateLimit: {
		// O padrão do Better Auth é ligar só em produção; o container roda `next dev`.
		enabled: true,
		storage: 'memory', // zera quando o container reinicia
		window: 60, // segundos
		max: 100, // demais rotas de /api/auth
		customRules: {
			'/sign-in/email': { window: 60, max: 5 },
			'/sign-up/email': { window: 60, max: 3 },
		},
	},
	// Mesmas regras do formulário, também para quem chama a API direto
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/sign-up/email') return;
			const result = signUpSchema.safeParse(ctx.body);
			if (!result.success) {
				throw new APIError('BAD_REQUEST', { message: Object.values(fieldErrors(result.error))[0] });
			}
		}),
	},
	// nextCookies() precisa ser o último plugin: grava os cookies quando auth.api.* roda no servidor.
	plugins: [
		// TOTP (app autenticador) + códigos de recuperação. Só é pedido no login com e-mail e senha:
		// no OAuth quem autentica é o provedor (decisão em docs/decisoes/README.md).
		twoFactor({ issuer: 'Trilhas SP' }),
		nextCookies(),
	],
});
