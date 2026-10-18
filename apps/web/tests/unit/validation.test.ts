import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createActivitySchema, updateActivitySchema } from '@/lib/validation/activity';
import { createTrailSchema, MAX_ROUTE_POINTS, updateTrailSchema } from '@/lib/validation/trail';
import { activityListSchema } from '@/server/activities/schemas';
import { trailSearchSchema } from '@/server/trails/schemas';

// Caminhos dos campos que falharam ("" = erro no objeto inteiro)
function failedPaths(schema: z.ZodType, data: unknown) {
	const result = schema.safeParse(data);
	return result.success ? [] : result.error.issues.map((issue) => issue.path.map(String).join('.'));
}

const route = {
	type: 'LineString',
	coordinates: [
		[-46.6, -23.5],
		[-46.6, -23.51],
	],
};

describe('createTrailSchema', () => {
	it('aceita o mínimo e aplica os padrões', () => {
		const trail = createTrailSchema.parse({ title: 'Pico do Jaraguá', route });
		expect(trail).toMatchObject({ title: 'Pico do Jaraguá', difficulty: 'MODERATE', visibility: 'PUBLIC' });
	});

	it('apara o título e transforma descrição vazia em null', () => {
		const trail = createTrailSchema.parse({ title: '  Jaraguá  ', description: '   ', route });
		expect(trail.title).toBe('Jaraguá');
		expect(trail.description).toBeNull();
	});

	it('descarta campos que o cliente não pode mandar (ex.: distance)', () => {
		const trail = createTrailSchema.parse({ title: 'Jaraguá', route, distance: 1, authorId: 'outro' });
		expect(trail).not.toHaveProperty('distance');
		expect(trail).not.toHaveProperty('authorId');
	});

	it('aceita MultiLineString e posições com elevação', () => {
		const multi = { type: 'MultiLineString', coordinates: [[[-46.6, -23.5, 800], [-46.6, -23.51, 820]]] };
		expect(failedPaths(createTrailSchema, { title: 'Jaraguá', route: multi })).toEqual([]);
	});

	it.each([
		['título curto', { title: 'ab', route }, 'title'],
		['sem percurso', { title: 'Jaraguá' }, 'route'],
		['dificuldade inválida', { title: 'Jaraguá', route, difficulty: 'EXTREMA' }, 'difficulty'],
		['visibilidade inválida', { title: 'Jaraguá', route, visibility: 'AMIGOS' }, 'visibility'],
		['linha com 1 ponto', { title: 'Jaraguá', route: { type: 'LineString', coordinates: [[-46.6, -23.5]] } }, 'route.coordinates'],
		['latitude fora do intervalo', { title: 'Jaraguá', route: { type: 'LineString', coordinates: [[-46.6, 95], [-46.6, -23.5]] } }, 'route.coordinates.0.1'],
		['longitude fora do intervalo', { title: 'Jaraguá', route: { type: 'LineString', coordinates: [[-190, -23.5], [-46.6, -23.5]] } }, 'route.coordinates.0.0'],
		['posição com 4 números', { title: 'Jaraguá', route: { type: 'LineString', coordinates: [[-46.6, -23.5, 1, 2], [-46.6, -23.5]] } }, 'route.coordinates.0'],
		['geometria Point', { title: 'Jaraguá', route: { type: 'Point', coordinates: [-46.6, -23.5] } }, 'route.type'],
	])('recusa %s', (_name, data, path) => {
		expect(failedPaths(createTrailSchema, data)).toContain(path);
	});

	it(`recusa percurso com mais de ${MAX_ROUTE_POINTS} pontos`, () => {
		const coordinates = Array.from({ length: MAX_ROUTE_POINTS + 1 }, (_, i) => [-46.6 + i * 1e-5, -23.5]);
		expect(failedPaths(createTrailSchema, { title: 'Jaraguá', route: { type: 'LineString', coordinates } })).toContain('route');
	});
});

describe('updateTrailSchema', () => {
	it('recusa objeto sem campos', () => {
		expect(failedPaths(updateTrailSchema, {})).toEqual(['']);
	});

	it('aceita um campo só e permite apagar a descrição', () => {
		expect(updateTrailSchema.parse({ description: null })).toEqual({ description: null });
		expect(updateTrailSchema.parse({ title: 'Novo nome' })).toEqual({ title: 'Novo nome' });
	});

	it('não aplica padrões (só altera o que veio)', () => {
		expect(updateTrailSchema.parse({ title: 'Novo nome' })).not.toHaveProperty('difficulty');
	});
});

describe('createActivitySchema', () => {
	it('converte números e datas vindos de <input>', () => {
		const activity = createActivitySchema.parse({ title: 'Corrida', distance: '5000', duration: '1800', startedAt: '2026-10-10T08:00:00Z' });
		expect(activity).toMatchObject({ distance: 5000, duration: 1800 });
		expect(activity.startedAt).toEqual(new Date('2026-10-10T08:00:00Z'));
	});

	it('aceita só a trilha, sem distância', () => {
		expect(failedPaths(createActivitySchema, { title: 'Funil', duration: 3600, trailId: 'abc' })).toEqual([]);
	});

	it.each([
		['sem distância e sem trilha', { title: 'Corrida', duration: 1800 }, 'distance'],
		['título vazio', { title: '  ', distance: 1, duration: 1800 }, 'title'],
		['duração zero', { title: 'Corrida', distance: 1, duration: 0 }, 'duration'],
		['duração fracionária', { title: 'Corrida', distance: 1, duration: 1.5 }, 'duration'],
		['distância negativa', { title: 'Corrida', distance: -1, duration: 1800 }, 'distance'],
		['distância acima de 1000 km', { title: 'Corrida', distance: 1_000_001, duration: 1800 }, 'distance'],
		['data no futuro', { title: 'Corrida', distance: 1, duration: 1800, startedAt: '2999-01-01' }, 'startedAt'],
		['data inválida', { title: 'Corrida', distance: 1, duration: 1800, startedAt: 'ontem' }, 'startedAt'],
	])('recusa %s', (_name, data, path) => {
		expect(failedPaths(createActivitySchema, data)).toContain(path);
	});
});

describe('updateActivitySchema', () => {
	it('recusa objeto sem campos', () => {
		expect(failedPaths(updateActivitySchema, {})).toEqual(['']);
	});

	it('trailId null desvincula a trilha', () => {
		expect(updateActivitySchema.parse({ trailId: null })).toEqual({ trailId: null });
	});
});

describe('trailSearchSchema', () => {
	it('aplica os padrões', () => {
		expect(trailSearchSchema.parse({})).toEqual({ page: 1, pageSize: 20, radiusKm: 10, sort: 'title', order: 'asc' });
	});

	it('aceita dificuldade separada por vírgula ou repetida', () => {
		expect(trailSearchSchema.parse({ difficulty: 'EASY,HARD' }).difficulty).toEqual(['EASY', 'HARD']);
		expect(trailSearchSchema.parse({ difficulty: ['EASY', 'HARD'] }).difficulty).toEqual(['EASY', 'HARD']);
	});

	it('converte bbox, near e circular', () => {
		const filters = trailSearchSchema.parse({ bbox: '-46.7,-23.6,-46.6,-23.5', near: '-23.77, -46.3', circular: 'true' });
		expect(filters.bbox).toEqual([-46.7, -23.6, -46.6, -23.5]);
		expect(filters.near).toEqual([-23.77, -46.3]);
		expect(filters.circular).toBe(true);
	});

	it.each([
		['pageSize acima de 50', { pageSize: '51' }, 'pageSize'],
		['página zero', { page: '0' }, 'page'],
		['página não numérica', { page: 'abc' }, 'page'],
		['dificuldade inválida', { difficulty: 'EASY,FACIL' }, 'difficulty.1'],
		['bbox com 3 números', { bbox: '1,2,3' }, 'bbox'],
		['bbox com texto', { bbox: 'a,b,c,d' }, 'bbox.0'],
		['bbox invertido', { bbox: '-46.6,-23.5,-46.7,-23.6' }, 'bbox'],
		['near fora do intervalo', { near: '95,10' }, 'near.0'],
		['raio acima de 200 km', { near: '-23.5,-46.6', radiusKm: '500' }, 'radiusKm'],
		['distância mínima maior que a máxima', { minDistanceKm: '10', maxDistanceKm: '2' }, 'maxDistanceKm'],
		['ganho mínimo maior que o máximo', { minGainM: '500', maxGainM: '100' }, 'maxGainM'],
		['author diferente de me', { author: 'outro' }, 'author'],
		['ordenação desconhecida', { sort: 'senha' }, 'sort'],
	])('recusa %s', (_name, data, path) => {
		expect(failedPaths(trailSearchSchema, data)).toContain(path);
	});
});

describe('activityListSchema', () => {
	it('ordena da mais recente por padrão', () => {
		expect(activityListSchema.parse({}).order).toBe('desc');
	});

	it('recusa from depois de to', () => {
		expect(failedPaths(activityListSchema, { from: '2026-10-12', to: '2026-10-01' })).toContain('to');
	});
});
