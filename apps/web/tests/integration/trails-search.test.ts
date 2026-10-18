import type { Trail, User } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getTrailRoute } from '@/app/api/trails/[id]/route';
import { GET as searchRoute } from '@/app/api/trails/route';
import { prisma } from '@/lib/db';
import { ApiError } from '@/server/api';
import { type TrailSearch, trailSearchSchema } from '@/server/trails/schemas';
import { getTrail, searchTrails } from '@/server/trails/service';
import { createTrail, createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/api/session', () => import('../helpers/session'));

// Catálogo de teste: 3 trilhas do OSM, 1 pública e 1 privada da Ana
let ana: User;
let bia: User;
let cachoeira: Trail;
let jaragua: Trail;
let caminho: Trail;
let privadaAna: Trail;
let publicaAna: Trail;

beforeEach(async () => {
	await resetDatabase();
	signInAs(null);
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	cachoeira = await createTrail({
		title: 'Cachoeira Grande',
		source: 'OSM',
		difficulty: 'EASY',
		distance: 2000,
		elevationGain: 100,
		isCircular: true,
		lat: -23.5,
		lon: -46.6,
	});
	jaragua = await createTrail({
		title: 'Pico do Jaraguá',
		description: 'Vista da CACHOEIRA ao longe',
		source: 'OSM',
		difficulty: 'HARD',
		distance: 8000,
		elevationGain: 600,
		lat: -23.45,
		lon: -46.76,
	});
	caminho = await createTrail({
		title: 'Caminho do Mar',
		source: 'OSM',
		difficulty: 'MODERATE',
		distance: 5000,
		elevationGain: null,
		lat: -23.9,
		lon: -46.4,
	});
	privadaAna = await createTrail({
		title: 'Trilha Privada da Ana',
		source: 'USER',
		authorId: ana.id,
		visibility: 'PRIVATE',
		difficulty: 'MODERATE',
		distance: 3000,
		elevationGain: 200,
		lat: -23.5,
		lon: -46.6,
	});
	publicaAna = await createTrail({
		title: 'Trilha Pública da Ana',
		source: 'USER',
		authorId: ana.id,
		difficulty: 'EASY',
		distance: 1000,
		elevationGain: 50,
		lat: -23.6,
		lon: -46.7,
	});
});

afterAll(async () => {
	await prisma.$disconnect();
});

// Busca com os filtros já validados pelo schema (como faz a rota)
async function search(query: Record<string, string> = {}, viewer: User | null = null) {
	const filters: TrailSearch = trailSearchSchema.parse(query);
	return searchTrails(filters, viewer?.id ?? null);
}

const ids = (result: { items: { id: string }[] }) => result.items.map((t) => t.id).sort();
const sorted = (...trails: Trail[]) => trails.map((t) => t.id).sort();

describe('visibilidade', () => {
	it('anônimo vê só as públicas', async () => {
		const result = await search();
		expect(result.total).toBe(4);
		expect(ids(result)).toEqual(sorted(cachoeira, jaragua, caminho, publicaAna));
	});

	it('a autora vê também a privada dela', async () => {
		expect((await search({}, ana)).total).toBe(5);
	});

	it('outra pessoa não vê a privada da Ana', async () => {
		expect(ids(await search({}, bia))).not.toContain(privadaAna.id);
	});

	it('author=me exige login e traz só as trilhas da pessoa', async () => {
		await expect(search({ author: 'me' })).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
		expect(ids(await search({ author: 'me' }, ana))).toEqual(sorted(privadaAna, publicaAna));
		expect((await search({ author: 'me' }, bia)).total).toBe(0);
	});
});

describe('filtros', () => {
	it('q procura no título e na descrição, sem diferenciar maiúsculas', async () => {
		expect(ids(await search({ q: 'cachoeira' }))).toEqual(sorted(cachoeira, jaragua));
	});

	it('difficulty com vários valores', async () => {
		expect(ids(await search({ difficulty: 'EASY,HARD' }))).toEqual(sorted(cachoeira, jaragua, publicaAna));
	});

	it('faixa de distância em km (gravada em metros)', async () => {
		expect(ids(await search({ minDistanceKm: '2', maxDistanceKm: '5' }))).toEqual(sorted(cachoeira, caminho));
		expect(ids(await search({ minDistanceKm: '2', maxDistanceKm: '5' }, ana))).toEqual(
			sorted(cachoeira, caminho, privadaAna),
		);
	});

	it('faixa de ganho exclui trilhas sem desnível', async () => {
		expect(ids(await search({ minGainM: '100' }))).toEqual(sorted(cachoeira, jaragua));
		expect(ids(await search({ maxGainM: '60' }))).toEqual(sorted(publicaAna));
	});

	it('source e circular', async () => {
		expect(ids(await search({ source: 'USER' }))).toEqual(sorted(publicaAna));
		expect(ids(await search({ circular: 'true' }))).toEqual(sorted(cachoeira));
	});

	it('bbox traz as trilhas que cruzam a área', async () => {
		// área pequena em volta de (-23.5, -46.6), onde começam a Cachoeira e a privada da Ana
		expect(ids(await search({ bbox: '-46.605,-23.505,-46.595,-23.495' }))).toEqual(sorted(cachoeira));
		// área que só toca o canto nordeste do bbox da Cachoeira (-46.59, -23.49)
		expect(ids(await search({ bbox: '-46.591,-23.491,-46.58,-23.48' }))).toEqual(sorted(cachoeira));
		// área vazia
		expect((await search({ bbox: '-40,-20,-39,-19' })).total).toBe(0);
	});

	it('near + radiusKm', async () => {
		expect(ids(await search({ near: '-23.9,-46.4', radiusKm: '2' }))).toEqual(sorted(caminho));
	});

	it('filtros se combinam (E)', async () => {
		expect(ids(await search({ difficulty: 'EASY', minDistanceKm: '1.5' }))).toEqual(sorted(cachoeira));
	});
});

describe('ordenação e paginação', () => {
	it('elevationGain desc com as trilhas sem desnível no fim', async () => {
		const result = await search({ sort: 'elevationGain', order: 'desc' });
		expect(result.items.map((t) => t.title)).toEqual([
			'Pico do Jaraguá',
			'Cachoeira Grande',
			'Trilha Pública da Ana',
			'Caminho do Mar',
		]);
	});

	it('páginas sem repetir nem pular itens', async () => {
		const page1 = await search({ pageSize: '2', page: '1' });
		const page2 = await search({ pageSize: '2', page: '2' });
		const page3 = await search({ pageSize: '2', page: '3' });
		expect(page1.items.map((t) => t.title)).toEqual(['Cachoeira Grande', 'Caminho do Mar']);
		expect(page2.items.map((t) => t.title)).toEqual(['Pico do Jaraguá', 'Trilha Pública da Ana']);
		expect(page3.items).toEqual([]);
		expect(page1).toMatchObject({ page: 1, pageSize: 2, total: 4 });
	});
});

describe('formato da resposta', () => {
	it('lista sem percurso, com início, bbox e autor (id e nome)', async () => {
		const result = await search({ source: 'USER' });
		expect(result.items[0]).toMatchObject({
			title: 'Trilha Pública da Ana',
			author: { id: ana.id, name: 'Ana' },
			start: { lat: -23.6, lon: -46.7 },
			// oeste, sul, leste, norte
			bbox: [publicaAna.minLon, publicaAna.minLat, publicaAna.maxLon, publicaAna.maxLat],
		});
		expect(result.items[0]).not.toHaveProperty('routeGeoJSON');
		expect(result.items[0]).not.toHaveProperty('authorId');
	});

	it('trilha do OSM vem com author null', async () => {
		const result = await search({ source: 'OSM', pageSize: '1' });
		expect(result.items[0].author).toBeNull();
	});
});

describe('getTrail', () => {
	it('detalhe com o percurso e sem authorId', async () => {
		const trail = await getTrail(publicaAna.id, null);
		expect(trail.routeGeoJSON).toMatchObject({ type: 'MultiLineString' });
		expect(trail.author).toEqual({ id: ana.id, name: 'Ana' });
		expect(trail).not.toHaveProperty('authorId');
	});

	it('privada: só a autora vê; para os outros, não existe', async () => {
		expect((await getTrail(privadaAna.id, ana.id)).title).toBe('Trilha Privada da Ana');
		for (const viewer of [null, bia.id]) {
			const error = await getTrail(privadaAna.id, viewer).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(ApiError);
			expect(error).toMatchObject({ status: 404, code: 'TRAIL_NOT_FOUND' });
		}
	});

	it('id inexistente → TRAIL_NOT_FOUND', async () => {
		await expect(getTrail('nao-existe', null)).rejects.toMatchObject({ code: 'TRAIL_NOT_FOUND' });
	});
});

describe('rotas', () => {
	const get = (query: string) => searchRoute(new Request(`http://localhost/api/trails${query}`), undefined);
	const detail = (id: string) =>
		getTrailRoute(new Request(`http://localhost/api/trails/${id}`), { params: Promise.resolve({ id }) });

	it('GET /api/trails com filtro inválido → 400', async () => {
		const response = await get('?difficulty=FACIL');
		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
	});

	it('GET /api/trails usa o usuário da sessão', async () => {
		expect((await get('?author=me')).status).toBe(401);
		signInAs(ana);
		const response = await get('?author=me');
		expect(response.status).toBe(200);
		expect((await response.json()).total).toBe(2);
	});

	it('GET /api/trails/:id da privada: 404 para anônimo, 200 para a autora', async () => {
		const anonymous = await detail(privadaAna.id);
		expect(anonymous.status).toBe(404);
		expect((await anonymous.json()).error.code).toBe('TRAIL_NOT_FOUND');
		signInAs(ana);
		expect((await detail(privadaAna.id)).status).toBe(200);
	});
});
