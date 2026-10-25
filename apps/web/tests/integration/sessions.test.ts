import type { User } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { describeDevice, listSessions, revokeOtherSessions, revokeSession } from '@/server/auth/sessions';
import { createUser, resetDatabase } from '../helpers/db';

let ana: User;
let bia: User;
const future = new Date('2030-01-01');

async function session(id: string, userId: string, expiresAt = future) {
	return prisma.session.create({ data: { id, token: `token-${id}`, userId, expiresAt, updatedAt: new Date() } });
}

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	await session('ana-1', ana.id);
	await session('ana-2', ana.id);
	await session('ana-velha', ana.id, new Date('2000-01-01'));
	await session('bia-1', bia.id);
});

describe('sessões', () => {
	it('lista só as sessões válidas da pessoa, sem o token', async () => {
		const sessions = await listSessions(ana.id);
		expect(sessions.map((s) => s.id).sort()).toEqual(['ana-1', 'ana-2']);
		expect(sessions[0]).not.toHaveProperty('token');
	});

	it('não encerra a sessão de outra pessoa, mesmo sabendo o id', async () => {
		const result = await revokeSession(ana.id, 'bia-1');
		expect(result.count).toBe(0);
		expect(await prisma.session.findUnique({ where: { id: 'bia-1' } })).not.toBeNull();
	});

	it('encerra uma sessão própria', async () => {
		await revokeSession(ana.id, 'ana-2');
		expect(await prisma.session.findUnique({ where: { id: 'ana-2' } })).toBeNull();
	});

	it('"encerrar as outras" mantém a atual e não toca nas de outra pessoa', async () => {
		await revokeOtherSessions(ana.id, 'ana-1');
		const left = await prisma.session.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
		expect(left.map((s) => s.id)).toEqual(['ana-1', 'bia-1']);
	});

	it('descreve o dispositivo pelo User-Agent', () => {
		expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/147.0 Safari/537.36')).toBe('Chrome no Linux');
		expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe('Safari no iOS');
		expect(describeDevice(null)).toBe('Dispositivo desconhecido');
	});
});
