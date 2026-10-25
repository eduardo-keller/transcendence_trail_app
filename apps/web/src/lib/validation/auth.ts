import { z } from 'zod';

// Schemas de conta compartilhados entre os formulários (cliente) e o servidor.
// Não importe nada de servidor aqui.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const email = z.string().trim().toLowerCase().email('E-mail inválido').max(254);
const password = z
	.string()
	.min(PASSWORD_MIN, `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres`)
	.max(PASSWORD_MAX, `A senha pode ter no máximo ${PASSWORD_MAX} caracteres`);

export const nameSchema = z.string().trim().min(2, 'Nome com pelo menos 2 caracteres').max(60);

export const signUpSchema = z.object({ name: nameSchema, email, password });

// No login não repetimos as regras de tamanho: senha errada é só "incorreta"
export const signInSchema = z.object({
	email,
	password: z.string().min(1, 'Digite a senha').max(PASSWORD_MAX),
});

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Digite a senha atual').max(PASSWORD_MAX),
		newPassword: password,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ['confirmPassword'],
		message: 'As senhas não conferem',
	});

// Senha para confirmar uma ação sensível (ativar 2FA, excluir a conta...)
export const passwordConfirmSchema = z.object({ password: z.string().min(1, 'Digite a sua senha').max(PASSWORD_MAX) });

// Código de 6 dígitos do app autenticador
export const totpCodeSchema = z.object({
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, 'O código tem 6 dígitos'),
});

export const backupCodeSchema = z.object({ code: z.string().trim().min(1, 'Digite um código de recuperação').max(32) });

export type SignUpInput = z.input<typeof signUpSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type SignInInput = z.input<typeof signInSchema>;

// Erros do zod por campo, para mostrar ao lado de cada input
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const field = String(issue.path[0] ?? '');
		errors[field] ??= issue.message;
	}
	return errors;
}
