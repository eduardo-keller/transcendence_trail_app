import { z } from 'zod';
import { nameSchema } from './auth';

// Schemas do perfil compartilhados entre o formulário (cliente) e o servidor.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const BIO_MAX = 300;

export const usernameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(USERNAME_MIN, `Nome de usuário com pelo menos ${USERNAME_MIN} caracteres`)
	.max(USERNAME_MAX, `Nome de usuário com no máximo ${USERNAME_MAX} caracteres`)
	.regex(/^[a-z0-9_]+$/, 'Use só letras sem acento, números e _');

export const profileSchema = z.object({
	name: nameSchema,
	username: usernameSchema,
	// '' vira null; aceita null porque o formulário já manda o valor transformado
	bio: z
		.string()
		.trim()
		.max(BIO_MAX, `Bio com no máximo ${BIO_MAX} caracteres`)
		.transform((value) => value || null)
		.nullable()
		.optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;

// "Ana Lúcia Souza" → "analucia1234": base do nome + 4 dígitos aleatórios.
// O sufixo evita "verificar e depois inserir": quem garante a unicidade é o @unique do banco.
export function generateUsername(name: string) {
	const base = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, USERNAME_MAX - 4);
	const suffix = String(Math.floor(1000 + Math.random() * 9000));
	return `${base || 'user'}${suffix}`;
}
