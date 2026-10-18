import type { Trail, User } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { createActivityAction, deleteActivityAction, updateActivityAction } from '@/server/activities/actions';
import { activityListSchema } from '@/server/activities/schemas';
import { getActivity, getActivityStats, listActivities } from '@/server/activities/service';
import { createTrail, createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/api/session', () => import('../helpers/session'));

let ana: User;
let bia: User;
let publica: Trail;
let privadaBia: Trail;

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	publica = await createTrail({ title: 'Cachoeira do Funil', source: 'OSM', distance: 9680 });
	privadaBia = await createTrail({ title: 'Segredo da Bia', authorId: bia.id, visibility: 'PRIVATE' });
	signInAs(ana);
});

afterAll(async () => {
	await prisma.$disconnect();
});

async function anaCreates(input: Record<string, unknown>) {
	const result = await createActivityAction({ title: 'Atividade', duration: 3600, ...input });
	if ('error' in result) throw new Error(`não criou: ${JSON.stringify(result.error)}`);
	return result.data.id;
}

const list = (user: User, query: Record<string, string> = {}) => listActivities(user.id, activityListSchema.parse(query));

describe('createActivityAction', () => {
	it('sem login → UNAUTHORIZED', async () => {
		signInAs(null);
		expect(await createActivityAction({ title: 'Corrida', distance: 5000, duration: 1800 })).toMatchObject({
			ok: false,
			error: { code: 'UNAUTHORIZED' },
		});
	});

	it('grava com o dono da sessão, aceitando números como texto', async () => {
		const id = await anaCreates({ title: 'Corrida', distance: '5000', duration: '1800', userId: bia.id });
		expect(await prisma.activity.findUniqueOrThrow({ where: { id } })).toMatchObject({
			title: 'Corrida',
			distance: 5000,
			duration: 1800,
			userId: ana.id,
			trailId: null,
		});
	});

	it('sem distância, usa a da trilha', async () => {
		const id = await anaCreates({ trailId: publica.id });
		expect(await prisma.activity.findUniqueOrThrow({ where: { id } })).toMatchObject({ distance: 9680, trailId: publica.id });
	});

	it('não vincula trilha privada de outra pessoa nem trilha inexistente', async () => {
		for (const trailId of [privadaBia.id, 'nao-existe']) {
			expect(await createActivityAction({ title: 'X', duration: 60, trailId })).toMatchObject({
				ok: false,
				error: { code: 'TRAIL_NOT_FOUND' },
			});
		}
		expect(await prisma.activity.count()).toBe(0);
	});

	it('entrada inválida → VALIDATION_ERROR', async () => {
		expect(await createActivityAction({ title: 'X', duration: 60 })).toMatchObject({
			ok: false,
			error: { code: 'VALIDATION_ERROR' },
		});
	});
});

describe('consultas', () => {
	beforeEach(async () => {
		await anaCreates({ title: 'Outubro 1', distance: 1000, startedAt: '2026-10-01T10:00:00Z' });
		await anaCreates({ title: 'Outubro 10', trailId: publica.id, startedAt: '2026-10-10T10:00:00Z' });
		await anaCreates({ title: 'Outubro 15', distance: 3000, startedAt: '2026-10-15T10:00:00Z' });
		signInAs(bia);
		await createActivityAction({ title: 'Da Bia', distance: 500, duration: 600 });
		signInAs(ana);
	});

	it('lista só as atividades da pessoa, da mais recente para a mais antiga', async () => {
		const result = await list(ana);
		expect(result.total).toBe(3);
		expect(result.items.map((a) => a.title)).toEqual(['Outubro 15', 'Outubro 10', 'Outubro 1']);
		expect(result.items[1].trail).toEqual({ id: publica.id, title: 'Cachoeira do Funil' });
	});

	it('filtra por trilha, por período e pagina', async () => {
		expect((await list(ana, { trailId: publica.id })).items.map((a) => a.title)).toEqual(['Outubro 10']);
		expect((await list(ana, { from: '2026-10-05', to: '2026-10-12' })).items.map((a) => a.title)).toEqual(['Outubro 10']);
		const page = await list(ana, { order: 'asc', pageSize: '2', page: '2' });
		expect(page.items.map((a) => a.title)).toEqual(['Outubro 15']);
		expect(page.total).toBe(3);
	});

	it('detalhe: só o dono; para os outros, não existe', async () => {
		const [first] = (await list(ana)).items;
		expect((await getActivity(first.id, ana.id)).title).toBe('Outubro 15');
		await expect(getActivity(first.id, bia.id)).rejects.toMatchObject({ status: 404, code: 'ACTIVITY_NOT_FOUND' });
	});

	it('estatísticas somam atividades, metros e segundos de cada pessoa', async () => {
		expect(await getActivityStats(ana.id)).toEqual({ activities: 3, distance: 1000 + 9680 + 3000, duration: 3 * 3600 });
		expect(await getActivityStats(bia.id)).toEqual({ activities: 1, distance: 500, duration: 600 });
		const nova = await createUser('Nova');
		expect(await getActivityStats(nova.id)).toEqual({ activities: 0, distance: 0, duration: 0 });
	});
});

describe('updateActivityAction e deleteActivityAction', () => {
	it('outra pessoa não altera nem apaga (404)', async () => {
		const id = await anaCreates({ title: 'Minha', distance: 1000 });
		signInAs(bia);
		expect(await updateActivityAction(id, { title: 'Hackeada' })).toMatchObject({ error: { code: 'ACTIVITY_NOT_FOUND' } });
		expect(await deleteActivityAction(id)).toMatchObject({ error: { code: 'ACTIVITY_NOT_FOUND' } });
		expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).title).toBe('Minha');
	});

	it('o dono altera, desvincula a trilha e apaga', async () => {
		const id = await anaCreates({ trailId: publica.id });
		expect(await updateActivityAction(id, { title: 'Editada', trailId: null })).toEqual({ ok: true, data: { id } });
		expect(await prisma.activity.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: 'Editada', trailId: null });
		expect(await deleteActivityAction(id)).toEqual({ ok: true, data: { id } });
		expect(await prisma.activity.findUnique({ where: { id } })).toBeNull();
	});

	it('não vincula, na edição, trilha privada de outra pessoa', async () => {
		const id = await anaCreates({ distance: 1000 });
		expect(await updateActivityAction(id, { trailId: privadaBia.id })).toMatchObject({ error: { code: 'TRAIL_NOT_FOUND' } });
	});

	it('sem campos → VALIDATION_ERROR', async () => {
		const id = await anaCreates({ distance: 1000 });
		expect(await updateActivityAction(id, {})).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
	});
});
