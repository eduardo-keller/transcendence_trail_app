import type { User } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { createActivityAction, updateActivityAction } from '@/server/activities/actions';
import { deleteTrailAction, updateTrailAction } from '@/server/trails/actions';
import { createTrail, createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/auth/session', () => import('../helpers/session'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let ana: User;
let bia: User;

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	signInAs(ana);
});

afterEach(() => {
	vi.restoreAllMocks();
});

afterAll(async () => {
	await prisma.$disconnect();
});

function codes(results: { ok: boolean; error?: { code: string } }[]) {
	return results.map((r) => (r.ok ? 'OK' : r.error?.code));
}

describe('trilha apagada entre a conferência e a gravação da atividade', () => {
	it('criar atividade → TRAIL_NOT_FOUND, não erro interno', async () => {
		const trail = await createTrail({ authorId: ana.id, source: 'USER' });
		const create = prisma.activity.create.bind(prisma.activity);
		vi.spyOn(prisma.activity, 'create').mockImplementationOnce((async (args: never) => {
			await prisma.trail.delete({ where: { id: trail.id } });
			return create(args);
		}) as never);

		const result = await createActivityAction({ title: 'Volta', duration: 600, trailId: trail.id });

		expect(result).toMatchObject({ ok: false, error: { code: 'TRAIL_NOT_FOUND' } });
		expect(await prisma.activity.count()).toBe(0);
	});

	it('editar atividade para essa trilha → TRAIL_NOT_FOUND, não erro interno', async () => {
		const trail = await createTrail({ authorId: ana.id, source: 'USER' });
		const activity = await prisma.activity.create({ data: { title: 'Volta', distance: 1000, duration: 600, userId: ana.id } });
		const update = prisma.activity.update.bind(prisma.activity);
		vi.spyOn(prisma.activity, 'update').mockImplementationOnce((async (args: never) => {
			await prisma.trail.delete({ where: { id: trail.id } });
			return update(args);
		}) as never);

		const result = await updateActivityAction(activity.id, { trailId: trail.id });

		expect(result).toMatchObject({ ok: false, error: { code: 'TRAIL_NOT_FOUND' } });
	});
});

describe('dono trocado entre a conferência e a gravação', () => {
	it('a edição não acontece se a trilha deixou de ser de quem pediu', async () => {
		const trail = await createTrail({ title: 'Original', authorId: ana.id, source: 'USER' });
		const update = prisma.trail.update.bind(prisma.trail);
		vi.spyOn(prisma.trail, 'update').mockImplementationOnce((async (args: never) => {
			await prisma.trail.updateMany({ where: { id: trail.id }, data: { authorId: bia.id } });
			return update(args);
		}) as never);

		const result = await updateTrailAction(trail.id, { title: 'Alterada pela Ana' });

		expect(result.ok).toBe(false);
		expect((await prisma.trail.findUniqueOrThrow({ where: { id: trail.id } })).title).toBe('Original');
	});
});

describe('requisições simultâneas', () => {
	it('10 exclusões da mesma trilha: exatamente 1 sucesso, as outras 404', async () => {
		const trail = await createTrail({ authorId: ana.id, source: 'USER' });

		const results = await Promise.all(Array.from({ length: 10 }, () => deleteTrailAction(trail.id)));

		const got = codes(results);
		expect(got.filter((c) => c === 'OK')).toHaveLength(1);
		expect(got.filter((c) => c !== 'OK').every((c) => c === 'TRAIL_NOT_FOUND' || c === 'NOT_FOUND')).toBe(true);
	});

	it('criar atividade enquanto a trilha é apagada (20 rodadas): nunca erro interno', async () => {
		const seen = new Set<string | undefined>();
		for (let round = 0; round < 20; round++) {
			const trail = await createTrail({ authorId: ana.id, source: 'USER' });
			const [created, deleted] = await Promise.all([
				createActivityAction({ title: 'Volta', duration: 600, trailId: trail.id }),
				deleteTrailAction(trail.id),
			]);
			for (const c of codes([created, deleted])) seen.add(c);
		}
		expect(seen.has('INTERNAL_ERROR')).toBe(false);
	});

	it('10 edições simultâneas da mesma atividade: todas ok e o resultado é uma delas inteira', async () => {
		const activity = await prisma.activity.create({ data: { title: 'Volta', distance: 1000, duration: 600, userId: ana.id } });
		const inputs = Array.from({ length: 10 }, (_, i) => ({ title: `Edição ${i}`, duration: 1000 + i }));

		const results = await Promise.all(inputs.map((input) => updateActivityAction(activity.id, input)));

		expect(codes(results).every((c) => c === 'OK')).toBe(true);
		const final = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } });
		expect(inputs).toContainEqual({ title: final.title, duration: final.duration });
	});
});
