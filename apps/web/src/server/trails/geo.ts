import type { RouteGeometry } from '@/lib/validation/trail';

// Cálculos sobre o percurso. Tudo é calculado no servidor: o cliente não informa distância nem desnível.

const EARTH_RADIUS_M = 6_371_008.8;
const CIRCULAR_MAX_GAP_M = 50; // início e fim a até 50 m: trilha circular
const WALK_SPEED_KMH = 5; // regra de Naismith: 5 km/h + 10 min a cada 100 m de subida
const MINUTES_PER_100M_GAIN = 10;

type Position = number[]; // [lon, lat] ou [lon, lat, elevação]

// Distância sobre a esfera entre dois pontos, em metros (fórmula de Haversine)
export function haversine([lon1, lat1]: Position, [lon2, lat2]: Position): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// LineString e MultiLineString viram uma lista de linhas (gravamos sempre MultiLineString)
export function toLines(route: RouteGeometry): Position[][] {
	return route.type === 'LineString' ? [route.coordinates] : route.coordinates;
}

export function routeStats(lines: Position[][]) {
	let distance = 0;
	let gain = 0;
	let loss = 0;
	const hasElevation = lines.every((line) => line.every((p) => p.length === 3));
	let minLat = Infinity;
	let minLon = Infinity;
	let maxLat = -Infinity;
	let maxLon = -Infinity;

	for (const line of lines) {
		line.forEach((point, i) => {
			const [lon, lat] = point;
			minLat = Math.min(minLat, lat);
			minLon = Math.min(minLon, lon);
			maxLat = Math.max(maxLat, lat);
			maxLon = Math.max(maxLon, lon);
			if (i === 0) return;
			const previous = line[i - 1];
			distance += haversine(previous, point);
			if (hasElevation) {
				const delta = point[2] - previous[2];
				if (delta > 0) gain += delta;
				else loss -= delta;
			}
		});
	}

	const start = lines[0][0];
	const lastLine = lines[lines.length - 1];
	const end = lastLine[lastLine.length - 1];
	const elevationGain = hasElevation ? Math.round(gain) : null;

	return {
		distance: Math.round(distance),
		elevationGain,
		elevationLoss: hasElevation ? Math.round(loss) : null,
		estimatedMinutes: Math.round(
			(distance / 1000 / WALK_SPEED_KMH) * 60 + ((elevationGain ?? 0) / 100) * MINUTES_PER_100M_GAIN,
		),
		isCircular: haversine(start, end) <= CIRCULAR_MAX_GAP_M,
		startLat: start[1],
		startLon: start[0],
		minLat,
		minLon,
		maxLat,
		maxLon,
	};
}
