import type { User } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { exportUserData } from '@/server/gdpr/export';
import { createTrail, createUser, resetDatabase } from '../helpers/db';

let ana: User;
let bia: User;

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	const trilha = await createTrail({ title: 'Trilha da Ana', authorId: ana.id });
	const community = await prisma.community.create({ data: { name: 'Caminhantes' } });
	await prisma.$transaction([
		prisma.account.create({
			data: { id: 'acc-ana', accountId: ana.id, providerId: 'credential', userId: ana.id, password: 'salt:hash-secreto' },
		}),
		prisma.session.create({
			data: {
				id: 'ses-ana',
				token: 'token-secreto',
				userId: ana.id,
				expiresAt: new Date('2030-01-01'),
				ipAddress: '10.0.0.1',
				updatedAt: new Date(),
			},
		}),
		prisma.activity.create({ data: { title: 'Fiz a trilha', distance: 1000, duration: 600, userId: ana.id, trailId: trilha.id } }),
		prisma.activity.create({ data: { title: 'Atividade da Bia', distance: 1, duration: 1, userId: bia.id } }),
		prisma.communityMember.create({ data: { role: 'ADMIN', userId: ana.id, communityId: community.id } }),
		prisma.notification.create({ data: { message: 'Bem-vinda', userId: ana.id } }),
	]);
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('exportUserData', () => {
	it('traz todas as seções com os dados da pessoa', async () => {
		const data = await exportUserData(ana.id);
		expect(Object.keys(data)).toEqual([
			'exportedAt',
			'profile',
			'accounts',
			'sessions',
			'trails',
			'activities',
			'communities',
			'events',
			'posts',
			'notifications',
			'badges',
		]);
		expect(data.profile).toMatchObject({ id: ana.id, name: 'Ana', email: ana.email });
		expect(data.accounts).toEqual([{ providerId: 'credential', createdAt: expect.any(Date) }]);
		expect(data.sessions).toEqual([expect.objectContaining({ ipAddress: '10.0.0.1' })]);
		expect(data.trails.map((t) => t.title)).toEqual(['Trilha da Ana']);
		expect(data.activities).toEqual([expect.objectContaining({ title: 'Fiz a trilha', trail: expect.objectContaining({ title: 'Trilha da Ana' }) })]);
		expect(data.communities).toEqual([expect.objectContaining({ name: 'Caminhantes', role: 'ADMIN' })]);
		expect(data.notifications.map((n) => n.message)).toEqual(['Bem-vinda']);
	});

	it('não traz dados de outras pessoas', async () => {
		const data = await exportUserData(ana.id);
		expect(JSON.stringify(data)).not.toContain('Atividade da Bia');
	});

	it('nunca inclui hash de senha nem tokens', async () => {
		const json = JSON.stringify(await exportUserData(ana.id));
		expect(json).not.toContain('hash-secreto');
		expect(json).not.toContain('token-secreto');
		expect(json).not.toMatch(/"(password|token|accessToken|refreshToken|idToken)"/);
	});

	it('usuário inexistente → 404', async () => {
		await expect(exportUserData('nao-existe')).rejects.toMatchObject({ status: 404 });
	});
});
