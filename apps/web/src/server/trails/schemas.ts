import { z } from 'zod';
import { paginationSchema } from '@/server/api';

// Filtros de GET /api/trails (contrato em docs/frentes/trilhas/README.md#api).
// A página /trilhas usa o mesmo schema para ler os searchParams.

// "EASY,MODERATE" ou ?difficulty=EASY&difficulty=MODERATE
function csvList<T extends z.ZodType>(item: T) {
	return z.preprocess(
		(value) => (Array.isArray(value) ? value : [value]).flatMap((part) => String(part).split(',')),
		z.array(item).min(1),
	);
}

// "a,b,c" → [a, b, c], validado pelo schema da tupla
function commaNumbers<T extends z.ZodType>(schema: T) {
	return z
		.string()
		.transform((text): unknown => text.split(',').map((part) => Number(part.trim())))
		.pipe(schema);
}

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

export const trailSearchSchema = paginationSchema
	.extend({
		q: z.string().trim().max(100).optional(),
		difficulty: csvList(z.enum(['EASY', 'MODERATE', 'HARD'])).optional(),
		minDistanceKm: z.coerce.number().min(0).optional(),
		maxDistanceKm: z.coerce.number().min(0).optional(),
		minGainM: z.coerce.number().min(0).optional(),
		maxGainM: z.coerce.number().min(0).optional(),
		// área visível do mapa: oeste, sul, leste, norte
		bbox: commaNumbers(z.tuple([longitude, latitude, longitude, latitude]))
			.refine(([west, south, east, north]) => west <= east && south <= north, 'Esperado oeste <= leste e sul <= norte')
			.optional(),
		// ponto "lat,lon" + raio em km
		near: commaNumbers(z.tuple([latitude, longitude])).optional(),
		radiusKm: z.coerce.number().positive().max(200).default(10),
		author: z.literal('me').optional(),
		source: z.enum(['OSM', 'USER']).optional(),
		circular: z.stringbool().optional(),
		sort: z.enum(['distance', 'elevationGain', 'title', 'createdAt']).default('title'),
		order: z.enum(['asc', 'desc']).default('asc'),
	})
	.refine(
		(f) => f.minDistanceKm === undefined || f.maxDistanceKm === undefined || f.minDistanceKm <= f.maxDistanceKm,
		{ path: ['maxDistanceKm'], message: 'maxDistanceKm deve ser maior ou igual a minDistanceKm' },
	)
	.refine((f) => f.minGainM === undefined || f.maxGainM === undefined || f.minGainM <= f.maxGainM, {
		path: ['maxGainM'],
		message: 'maxGainM deve ser maior ou igual a minGainM',
	});

export type TrailSearch = z.output<typeof trailSearchSchema>;

export const trailIdSchema = z.object({ id: z.string().min(1).max(64) });
