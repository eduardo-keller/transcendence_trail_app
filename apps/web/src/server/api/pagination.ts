import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// ?page=1&pageSize=20. Combine com os filtros da rota:
// parseQuery(request, paginationSchema.extend({ difficulty: ... }))
export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type Pagination = z.output<typeof paginationSchema>;

export type Paginated<T> = {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
};

// Converte para os argumentos do Prisma: prisma.trail.findMany({ ...paginate(query) })
export function paginate({ page, pageSize }: Pagination) {
	return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, { page, pageSize }: Pagination): Paginated<T> {
	return { items, page, pageSize, total };
}
