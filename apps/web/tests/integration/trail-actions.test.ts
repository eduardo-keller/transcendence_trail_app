import type { Trail, User } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { createTrailAction, deleteTrailAction, updateTrailAction } from '@/server/trails/actions';
import { createTrail, createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/api/session', () => import('../helpers/session'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// 3 pontos para o sul, com elevação: 1112 m, +50 m, -20 m
const route = {
	type: 'LineString' as const,
	coordinates: [
		[-46.6, -23.5, 800],
		[-46.6, -23.505, 850],
		[-46.6, -23.51, 830],
	],
};

let ana: User;
let bia: User;
let osm: Trail;

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(revalidatePath).mockClear();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	osm = await createTrail({ title: 'Trilha do OSM', source: 'OSM' });
	signInAs(ana);
});

afterAll(async () => {
	await prisma.$disconnect();
});

// Cria uma trilha da Ana pela action e devolve o id
async function anaCreates(input: Record<string, unknown> = {}) {
	const result = await createTrailAction({ title: 'Trilha da Ana', route, ...input });
	if ('error' in result) throw new Error(`não criou: ${JSON.stringify(result.error)}`);
	return result.data.id;
}

describe('createTrailAction', () => {
	it('sem login → UNAUTHORIZED', async () => {
		signInAs(null);
		expect(await createTrailAction({ title: 'Trilha', route })).toMatchObject({
			ok: false,
			error: { code: 'UNAUTHORIZED' },
		});
	});

	it('entrada inválida → VALIDATION_ERROR com os campos, e nada é gravado', async () => {
		const result = await createTrailAction({ title: 'ab', route: { type: 'LineString', coordinates: [[-46.6, -23.5]] } });
		expect(result.ok).toBe(false);
		if (!('error' in result)) return;
		expect(result.error.code).toBe('VALIDATION_ERROR');
		const paths = (result.error.details as { issues: { path: string }[] }).issues.map((i) => i.path);
		expect(paths).toEqual(expect.arrayContaining(['title', 'route.coordinates']));
		expect(await prisma.trail.count({ where: { source: 'USER' } })).toBe(0);
	});

	it('calcula tudo no servidor e ignora o que o cliente não pode mandar', async () => {
		const id = await anaCreates({ title: '  Pico  ', description: '', distance: 1, authorId: bia.id, source: 'OSM' });
		const trail = await prisma.trail.findUniqueOrThrow({ where: { id } });
		expect(trail).toMatchObject({
			title: 'Pico',
			description: null,
			source: 'USER',
			authorId: ana.id,
			difficulty: 'MODERATE',
			visibility: 'PUBLIC',
			distance: 1112,
			elevationGain: 50,
			elevationLoss: 20,
			estimatedMinutes: 18,
			isCircular: false,
			startLat: -23.5,
			startLon: -46.6,
			minLat: -23.51,
			maxLat: -23.5,
		});
		// LineString é gravado como MultiLineString, como as trilhas do OSM
		expect(trail.routeGeoJSON).toEqual({ type: 'MultiLineString', coordinates: [route.coordinates] });
		expect(revalidatePath).toHaveBeenCalledWith('/trilhas');
	});
});

describe('updateTrailAction', () => {
	it('a autora altera campos e a visibilidade', async () => {
		const id = await anaCreates();
		expect(await updateTrailAction(id, { title: 'Novo nome', visibility: 'PRIVATE' })).toEqual({ ok: true, data: { id } });
		expect(await prisma.trail.findUniqueOrThrow({ where: { id } })).toMatchObject({
			title: 'Novo nome',
			visibility: 'PRIVATE',
			distance: 1112, // o percurso não mudou
		});
		expect(revalidatePath).toHaveBeenCalledWith(`/trilhas/${id}`);
	});

	it('percurso novo recalcula distância, desnível e circular', async () => {
		const id = await anaCreates();
		const loop = {
			type: 'MultiLineString' as const,
			coordinates: [
				[
					[-46.6, -23.5],
					[-46.61, -23.5],
				],
				[
					[-46.61, -23.5],
					[-46.6, -23.5001],
				],
			],
		};
		await updateTrailAction(id, { route: loop });
		expect(await prisma.trail.findUniqueOrThrow({ where: { id } })).toMatchObject({
			distance: 2040,
			elevationGain: null,
			isCircular: true,
		});
	});

	it('outra pessoa: 403 na pública, 404 na privada (não revela que existe)', async () => {
		const id = await anaCreates();
		signInAs(bia);
		expect(await updateTrailAction(id, { title: 'Hackeada' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

		signInAs(ana);
		await updateTrailAction(id, { visibility: 'PRIVATE' });
		signInAs(bia);
		expect(await updateTrailAction(id, { title: 'Hackeada' })).toMatchObject({
			ok: false,
			error: { code: 'TRAIL_NOT_FOUND' },
		});
		expect((await prisma.trail.findUniqueOrThrow({ where: { id } })).title).toBe('Trilha da Ana');
	});

	it('trilha do OSM não é editável por ninguém', async () => {
		expect(await updateTrailAction(osm.id, { title: 'Minha' })).toMatchObject({
			ok: false,
			error: { code: 'TRAIL_NOT_EDITABLE' },
		});
	});

	it('sem campos → VALIDATION_ERROR; id inexistente → TRAIL_NOT_FOUND; sem login → UNAUTHORIZED', async () => {
		const id = await anaCreates();
		expect(await updateTrailAction(id, {})).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
		expect(await updateTrailAction('nao-existe', { title: 'Novo' })).toMatchObject({ error: { code: 'TRAIL_NOT_FOUND' } });
		signInAs(null);
		expect(await updateTrailAction(id, { title: 'Novo' })).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
	});
});

describe('deleteTrailAction', () => {
	it('outra pessoa não apaga; a autora apaga', async () => {
		const id = await anaCreates();
		signInAs(bia);
		expect(await deleteTrailAction(id)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
		signInAs(ana);
		expect(await deleteTrailAction(id)).toEqual({ ok: true, data: { id } });
		expect(await prisma.trail.findUnique({ where: { id } })).toBeNull();
		expect(await deleteTrailAction(id)).toMatchObject({ ok: false, error: { code: 'TRAIL_NOT_FOUND' } });
	});

	it('as atividades que apontavam para a trilha ficam, sem vínculo', async () => {
		const id = await anaCreates();
		const activity = await prisma.activity.create({
			data: { title: 'Fiz a trilha', distance: 1112, duration: 1800, userId: bia.id, trailId: id },
		});
		await deleteTrailAction(id);
		expect(await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })).toMatchObject({ trailId: null });
	});

	it('trilha do OSM não é apagável', async () => {
		expect(await deleteTrailAction(osm.id)).toMatchObject({ ok: false, error: { code: 'TRAIL_NOT_EDITABLE' } });
		expect(await prisma.trail.findUnique({ where: { id: osm.id } })).not.toBeNull();
	});
});
