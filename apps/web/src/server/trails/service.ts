import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { createTrailSchema, updateTrailSchema } from '@/lib/validation/trail';
import { ApiError, forbidden, paginate, paginated, unauthorized } from '@/server/api';
import type { z } from 'zod';
import { routeStats, toLines } from './geo';
import type { TrailSearch } from './schemas';

// Regras de negócio das trilhas. Usado pelas rotas /api/trails, pelas server actions
// e direto pelos Server Components. viewerId = usuário logado (null se anônimo).

export const trailNotFound = () => new ApiError(404, 'TRAIL_NOT_FOUND', 'Trilha não encontrada.');

const KM_PER_DEGREE_LAT = 111.32;

// Públicas para todos; privadas só para o autor
function visibleTo(viewerId: string | null): Prisma.TrailWhereInput {
	return viewerId ? { OR: [{ visibility: 'PUBLIC' }, { authorId: viewerId }] } : { visibility: 'PUBLIC' };
}

// Trilhas cujo bbox cruza a área: um retângulo começa antes de o outro terminar, nos dois eixos
function intersects(west: number, south: number, east: number, north: number): Prisma.TrailWhereInput {
	return {
		maxLon: { gte: west },
		minLon: { lte: east },
		maxLat: { gte: south },
		minLat: { lte: north },
	};
}

const summarySelect = {
	id: true,
	title: true,
	distance: true,
	elevationGain: true,
	estimatedMinutes: true,
	difficulty: true,
	visibility: true,
	source: true,
	isCircular: true,
	startLat: true,
	startLon: true,
	minLat: true,
	minLon: true,
	maxLat: true,
	maxLon: true,
	author: { select: { id: true, name: true } },
} satisfies Prisma.TrailSelect;

type SummaryRow = Prisma.TrailGetPayload<{ select: typeof summarySelect }>;

function toSummary({ startLat, startLon, minLat, minLon, maxLat, maxLon, ...rest }: SummaryRow) {
	return {
		...rest,
		start: startLat !== null && startLon !== null ? { lat: startLat, lon: startLon } : null,
		bbox: [minLon, minLat, maxLon, maxLat] as const, // oeste, sul, leste, norte
	};
}

export type TrailSummary = ReturnType<typeof toSummary>;

export async function searchTrails(filters: TrailSearch, viewerId: string | null) {
	const conditions: Prisma.TrailWhereInput[] = [visibleTo(viewerId)];

	if (filters.author === 'me') {
		if (!viewerId) throw unauthorized('Faça login para ver as suas trilhas.');
		conditions.push({ authorId: viewerId });
	}
	if (filters.q) {
		conditions.push({
			OR: [
				{ title: { contains: filters.q, mode: 'insensitive' } },
				{ description: { contains: filters.q, mode: 'insensitive' } },
			],
		});
	}
	if (filters.difficulty) conditions.push({ difficulty: { in: filters.difficulty } });
	if (filters.source) conditions.push({ source: filters.source });
	if (filters.circular !== undefined) conditions.push({ isCircular: filters.circular });
	if (filters.minDistanceKm !== undefined || filters.maxDistanceKm !== undefined) {
		conditions.push({
			distance: {
				gte: filters.minDistanceKm !== undefined ? filters.minDistanceKm * 1000 : undefined,
				lte: filters.maxDistanceKm !== undefined ? filters.maxDistanceKm * 1000 : undefined,
			},
		});
	}
	if (filters.minGainM !== undefined || filters.maxGainM !== undefined) {
		conditions.push({ elevationGain: { gte: filters.minGainM, lte: filters.maxGainM } });
	}
	if (filters.bbox) {
		const [west, south, east, north] = filters.bbox;
		conditions.push(intersects(west, south, east, north));
	}
	if (filters.near) {
		// Raio vira um bbox em volta do ponto (aproximação suficiente para a busca)
		const [lat, lon] = filters.near;
		const dLat = filters.radiusKm / KM_PER_DEGREE_LAT;
		const dLon = filters.radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
		conditions.push(intersects(lon - dLon, lat - dLat, lon + dLon, lat + dLat));
	}

	const where: Prisma.TrailWhereInput = { AND: conditions };
	// elevationGain pode ser nulo: nulos sempre no fim. id desempata, para a paginação ser estável.
	const orderBy: Prisma.TrailOrderByWithRelationInput[] = [
		filters.sort === 'elevationGain'
			? { elevationGain: { sort: filters.order, nulls: 'last' } }
			: { [filters.sort]: filters.order },
		{ id: 'asc' },
	];

	const [total, rows] = await prisma.$transaction([
		prisma.trail.count({ where }),
		prisma.trail.findMany({ where, orderBy, select: summarySelect, ...paginate(filters) }),
	], { isolationLevel: 'RepeatableRead' });
	return paginated(rows.map(toSummary), total, filters);
}

export async function getTrail(id: string, viewerId: string | null) {
	const trail = await prisma.trail.findFirst({
		where: { AND: [{ id }, visibleTo(viewerId)] },
		include: { author: { select: { id: true, name: true } } },
	});
	if (!trail) throw trailNotFound();
	const { startLat, startLon, minLat, minLon, maxLat, maxLon, authorId: _authorId, ...rest } = trail;
	return {
		...rest,
		start: startLat !== null && startLon !== null ? { lat: startLat, lon: startLon } : null,
		bbox: [minLon, minLat, maxLon, maxLat] as const,
	};
}

export type TrailDetail = Awaited<ReturnType<typeof getTrail>>;

// Percurso normalizado para MultiLineString + tudo o que é derivado dele
function routeData(route: z.output<typeof createTrailSchema>['route']) {
	const lines = toLines(route);
	return { routeGeoJSON: { type: 'MultiLineString', coordinates: lines }, ...routeStats(lines) };
}

export async function createTrail(input: z.output<typeof createTrailSchema>, authorId: string) {
	const { route, ...fields } = input;
	return prisma.trail.create({
		data: { ...fields, ...routeData(route), source: 'USER', authorId },
		select: { id: true },
	});
}

// Só o autor altera ou apaga; trilhas do OSM não são de ninguém.
// Quem não enxerga a trilha recebe 404 (não revela que ela existe).
async function findEditable(id: string, userId: string) {
	const trail = await prisma.trail.findFirst({
		where: { AND: [{ id }, visibleTo(userId)] },
		select: { id: true, authorId: true, source: true },
	});
	if (!trail) throw trailNotFound();
	if (trail.source === 'OSM') {
		throw new ApiError(403, 'TRAIL_NOT_EDITABLE', 'Trilhas importadas do OpenStreetMap não podem ser alteradas.');
	}
	if (trail.authorId !== userId) throw forbidden('Só o autor pode alterar esta trilha.');
	return trail;
}

export async function updateTrail(id: string, input: z.output<typeof updateTrailSchema>, userId: string) {
	await findEditable(id, userId);
	const { route, ...fields } = input;
	return prisma.trail.update({
		where: { id, authorId: userId },
		data: { ...fields, ...(route && routeData(route)) },
		select: { id: true },
	});
}

// As atividades que apontavam para a trilha ficam, com trailId nulo (onDelete: SetNull)
export async function deleteTrail(id: string, userId: string) {
	await findEditable(id, userId);
	return prisma.trail.delete({ where: { id, authorId: userId }, select: { id: true } });
}
