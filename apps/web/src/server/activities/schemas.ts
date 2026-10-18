import { z } from 'zod';
import { paginationSchema } from '@/server/api';

// Filtros da lista "minhas atividades" (a página lê os searchParams com este schema)
export const activityListSchema = paginationSchema
	.extend({
		trailId: z.string().min(1).max(64).optional(),
		from: z.coerce.date().optional(),
		to: z.coerce.date().optional(),
		order: z.enum(['asc', 'desc']).default('desc'), // por startedAt
	})
	.refine((f) => !f.from || !f.to || f.from <= f.to, { path: ['to'], message: 'to deve ser depois de from' });

export type ActivityList = z.output<typeof activityListSchema>;

export const activityIdSchema = z.object({ id: z.string().min(1).max(64) });
