import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { unauthorized } from './errors';

// PROVISÓRIO: a frente Identidade vai entregar getSession() e requireUser().
// Quando existirem, troque os usos destas duas funções por elas e apague este arquivo.

// Usuário logado nesta requisição (route handler ou server action), ou null
export async function getCurrentUser() {
	const session = await auth.api.getSession({ headers: await headers() });
	return session?.user ?? null;
}

// Igual a getCurrentUser, mas lança 401 se ninguém estiver logado
export async function requireCurrentUser() {
	const user = await getCurrentUser();
	if (!user) throw unauthorized();
	return user;
}
