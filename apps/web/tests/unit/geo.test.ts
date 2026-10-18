import { describe, expect, it } from 'vitest';
import { haversine, routeStats, toLines } from '@/server/trails/geo';

describe('haversine', () => {
	it('é zero para o mesmo ponto', () => {
		expect(haversine([-46.6, -23.5], [-46.6, -23.5])).toBe(0);
	});

	it('0,01° de latitude ≈ 1112 m', () => {
		expect(haversine([-46.6, -23.5], [-46.6, -23.51])).toBeCloseTo(1111.95, 0);
	});

	it('São Paulo (Sé) → Rio de Janeiro ≈ 361 km', () => {
		const km = haversine([-46.6333, -23.5505], [-43.1729, -22.9068]) / 1000;
		expect(km).toBeGreaterThan(355);
		expect(km).toBeLessThan(365);
	});

	it('usa [lon, lat] e ignora a elevação', () => {
		expect(haversine([-46.6, -23.5, 800], [-46.6, -23.51, 2000])).toBeCloseTo(1111.95, 0);
	});
});

describe('toLines', () => {
	it('LineString vira uma lista com uma linha', () => {
		const coordinates = [
			[-46.6, -23.5],
			[-46.6, -23.51],
		];
		expect(toLines({ type: 'LineString', coordinates })).toEqual([coordinates]);
	});

	it('MultiLineString fica como está', () => {
		const coordinates = [
			[
				[-46.6, -23.5],
				[-46.6, -23.51],
			],
			[
				[-46.7, -23.5],
				[-46.7, -23.51],
			],
		];
		expect(toLines({ type: 'MultiLineString', coordinates })).toEqual(coordinates);
	});
});

describe('routeStats', () => {
	const withElevation = [
		[
			[-46.6, -23.5, 800],
			[-46.6, -23.505, 850],
			[-46.6, -23.51, 830],
		],
	];

	it('soma a distância entre pontos consecutivos', () => {
		expect(routeStats(withElevation).distance).toBe(1112);
	});

	it('calcula ganho e perda quando todos os pontos têm elevação', () => {
		const stats = routeStats(withElevation);
		expect(stats.elevationGain).toBe(50);
		expect(stats.elevationLoss).toBe(20);
	});

	it('desnível nulo se algum ponto não tem elevação', () => {
		const stats = routeStats([
			[
				[-46.6, -23.5, 800],
				[-46.6, -23.51],
			],
		]);
		expect(stats.elevationGain).toBeNull();
		expect(stats.elevationLoss).toBeNull();
	});

	it('tempo estimado pela regra de Naismith (5 km/h + 10 min a cada 100 m de subida)', () => {
		// 1,112 km a 5 km/h = 13,3 min; 50 m de subida = 5 min
		expect(routeStats(withElevation).estimatedMinutes).toBe(18);
	});

	it('bbox e ponto inicial', () => {
		const stats = routeStats([
			[
				[-46.6, -23.5],
				[-46.65, -23.45],
				[-46.62, -23.55],
			],
		]);
		expect(stats).toMatchObject({
			startLat: -23.5,
			startLon: -46.6,
			minLat: -23.55,
			maxLat: -23.45,
			minLon: -46.65,
			maxLon: -46.6,
		});
	});

	it('circular quando o fim está a até 50 m do início', () => {
		const loop = [
			[
				[-46.6, -23.5],
				[-46.61, -23.5],
				[-46.6, -23.5003], // ~33 m do início
			],
		];
		expect(routeStats(loop).isCircular).toBe(true);
	});

	it('linear quando o fim está longe do início', () => {
		expect(routeStats(withElevation).isCircular).toBe(false);
	});

	it('não soma o salto entre linhas separadas de um MultiLineString', () => {
		const stats = routeStats([
			[
				[-46.6, -23.5],
				[-46.6, -23.51],
			],
			[
				[-47.6, -23.5], // ~100 km a oeste
				[-47.6, -23.51],
			],
		]);
		expect(stats.distance).toBe(2224);
	});
});
