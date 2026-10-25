import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { genericOAuth, twoFactor } from 'better-auth/plugins';
import { fieldErrors, signUpSchema } from './validation/auth';
import { generateUsername } from './validation/profile';
import { sendEmail } from '../server/email/send';
import { prisma } from './db';
import { githubProvider, intraProvider } from './oauth';

// BETTER_AUTH_SECRET e BETTER_AUTH_URL são lidos do ambiente pelo próprio Better Auth
// (o entrypoint do container exporta o segredo a partir do Docker secret).
export const auth = betterAuth({
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},
	// GitHub (nativo) e 42 (plugin genérico, abaixo); ligam só com as credenciais (lib/oauth.ts)
	socialProviders: githubProvider,
	account: {
		accountLinking: {
			// Conectar pela página /conta, já logado, pode usar outro e-mail (a pessoa prova que é dona das duas).
			// No login, o Better Auth só junta contas com o mesmo e-mail se a conta local tiver o e-mail verificado:
			// as nossas não têm, então ele recusa (protege contra quem cadastrou o e-mail de outra pessoa antes).
			allowDifferentEmails: true,
		},
	},
	// Erros de OAuth sem destino conhecido (ex.: state inválido) voltam para o login com ?error=
	onAPIError: { errorURL: '/login' },
	// Campos nossos no User. input: false = o cliente não manda; o servidor preenche.
	user: {
		// GDPR: excluir a conta pede a senha e depois a confirmação pelo link enviado por e-mail.
		// O link só vale uma vez e só para quem está logado nessa conta.
		deleteUser: {
			enabled: true,
			// O link abre uma página nossa com um botão (POST): abrir um link (GET) nunca apaga nada,
			// nem quando o serviço de e-mail visita o link sozinho para checar vírus.
			sendDeleteAccountVerification: async ({ user, token }) => {
				const url = `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/conta/excluir?token=${token}`;
				await sendEmail({
					to: user.email,
					subject: 'Confirme a exclusão da sua conta',
					text: `Olá, ${user.name}.\n\nPara excluir a sua conta da Trilhas SP e todos os seus dados, abra este link no mesmo navegador em que você está logado e confirme (vale por 24 horas):\n\n${url}\n\nSe não foi você, ignore este e-mail e troque a sua senha.\n`,
				});
			},
			afterDelete: async (user) => {
				await sendEmail({
					to: user.email,
					subject: 'Sua conta foi excluída',
					text: `Olá, ${user.name}.\n\nA sua conta da Trilhas SP e todos os seus dados foram excluídos.\n`,
				}).catch((error) => console.error('[e-mail] falha ao confirmar a exclusão', error));
			},
		},
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
		genericOAuth({ config: intraProvider }),
		nextCookies(),
	],
});
