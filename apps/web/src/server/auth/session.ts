import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { unauthorized } from '@/server/api';

// Sessão da requisição atual, ou null. cache(): uma consulta ao banco por requisição.
export const getSession = cache(async () => {
	return auth.api.getSession({ headers: await headers() });
});

// Route Handlers e Server Actions: sem login, lança 401.
export async function requireUser() {
	const session = await getSession();
	if (!session) throw unauthorized();
	return session.user;
}

// Páginas: sem login, manda para /login.
export async function requirePageUser() {
	const session = await getSession();
	if (!session) redirect('/login');
	return session.user;
}
