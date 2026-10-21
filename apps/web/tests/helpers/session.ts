import { unauthorized } from '@/server/api';

// Substitui src/server/auth/session.ts nos testes (que não têm requisição nem cookie):
//
//   vi.mock('@/server/auth/session', () => import('../helpers/session'));
//   signInAs(user);   // ou signInAs(null) para anônimo

type TestUser = { id: string; name?: string };

let current: TestUser | null = null;

export function signInAs(user: TestUser | null) {
	current = user;
}

export async function getSession() {
	return current ? { user: current } : null;
}

export async function requireUser() {
	if (!current) throw unauthorized();
	return current;
}

export async function requirePageUser() {
	if (!current) throw new Error('requirePageUser sem usuário: use signInAs() no teste');
	return current;
}
