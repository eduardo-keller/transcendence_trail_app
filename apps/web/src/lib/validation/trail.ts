import { z } from 'zod';

// Schemas de trilha compartilhados entre o formulário (cliente) e as server actions (servidor).
// Não importe nada de servidor aqui.

export const MAX_ROUTE_POINTS = 5000;

export const DIFFICULTIES = ['EASY', 'MODERATE', 'HARD'] as const;
export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;

// Posição GeoJSON: [lon, lat] ou [lon, lat, elevação]
const position = z
	.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)], z.number())
	.refine((p) => p.length <= 3, 'Posição deve ser [lon, lat] ou [lon, lat, elevação]');
const line = z.array(position).min(2, 'Cada linha precisa de pelo menos 2 pontos');

// Percurso em GeoJSON (ex.: convertido de um GPX no navegador)
export const routeSchema = z
	.discriminatedUnion('type', [
		z.object({ type: z.literal('LineString'), coordinates: line }),
		z.object({ type: z.literal('MultiLineString'), coordinates: z.array(line).min(1) }),
	])
	.refine(
		(route) =>
			(route.type === 'LineString' ? route.coordinates.length : route.coordinates.flat().length) <= MAX_ROUTE_POINTS,
		`O percurso pode ter no máximo ${MAX_ROUTE_POINTS} pontos`,
	);

const title = z.string().trim().min(3, 'Título com pelo menos 3 caracteres').max(120);
// '' vira null (campo apagado no formulário)
const description = z
	.string()
	.trim()
	.max(2000)
	.transform((value) => value || null)
	.nullable()
	.optional();
const difficulty = z.enum(DIFFICULTIES);
const visibility = z.enum(VISIBILITIES);

export const createTrailSchema = z.object({
	title,
	description,
	difficulty: difficulty.default('MODERATE'),
	visibility: visibility.default('PUBLIC'),
	route: routeSchema,
});

export const updateTrailSchema = z
	.object({ title, description, difficulty, visibility, route: routeSchema })
	.partial()
	.refine((fields) => Object.values(fields).some((value) => value !== undefined), 'Informe ao menos um campo');

export type CreateTrailInput = z.input<typeof createTrailSchema>;
export type UpdateTrailInput = z.input<typeof updateTrailSchema>;
export type RouteGeometry = z.output<typeof routeSchema>;
