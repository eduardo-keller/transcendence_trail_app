import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';

// Chama uma rota do Better Auth a partir de uma Server Action.
// Por que não auth.api.*? Porque o rate limit só vale para pedidos HTTP (auth.handler).
// Repassa o cookie e o IP do navegador, e copia para ele os cookies da resposta.
export async function callAuth(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST') {
	const incoming = await headers();
	const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
	const request = new Request(`${baseURL}/api/auth${path}`, {
		method,
		headers: {
			'content-type': 'application/json',
			origin: new URL(baseURL).origin,
			cookie: incoming.get('cookie') ?? '',
			'x-forwarded-for': incoming.get('x-forwarded-for') ?? '',
			'user-agent': incoming.get('user-agent') ?? '',
		},
		body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
	});

	const response = await auth.handler(request);

	const setCookie = response.headers.get('set-cookie');
	if (setCookie) {
		const store = await cookies();
		for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
			store.set(name, attributes.value, toCookieOptions(attributes));
		}
	}

	const data: unknown = await response.json().catch(() => null);
	return { status: response.status, data };
}
