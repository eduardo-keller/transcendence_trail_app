import { unauthorized } from '@/server/api';

// Substitui src/server/api/session.ts nos testes (que não têm requisição nem cookie):
//
//   vi.mock('@/server/api/session', () => import('../helpers/session'));
//   signInAs(user);   // ou signInAs(null) para anônimo

type TestUser = { id: string; name?: string };

let current: TestUser | null = null;

export function signInAs(user: TestUser | null) {
	current = user;
}

export async function getCurrentUser() {
	return current;
}

export async function requireCurrentUser() {
	if (!current) throw unauthorized();
	return current;
}
