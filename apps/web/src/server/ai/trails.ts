import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// As trilhas "de verdade" do dataset do OSM: 500 m ou mais e nome de trilha (~90 de 3.878; o resto são
// vielas e ruas, ver docs/dados-trilhas.md). É a lista do planejador e o critério do corpus do RAG
// (scripts/rag/describe-trails.mts repete estes valores). Quando o catálogo aplicar o filtro na
// importação, isto pode virar só "source: 'OSM'".
export const REAL_TRAIL_MIN_DISTANCE = 500;
export const REAL_TRAIL_WORDS = ['Trilha', 'Caminho', 'Pico', 'Cachoeira', 'Pedra'];

export const realTrailWhere = {
	source: 'OSM',
	visibility: 'PUBLIC',
	distance: { gte: REAL_TRAIL_MIN_DISTANCE },
	OR: REAL_TRAIL_WORDS.map((word) => ({ title: { contains: word, mode: 'insensitive' } })),
} satisfies Prisma.TrailWhereInput;

const optionSelect = { id: true, title: true, distance: true, difficulty: true } satisfies Prisma.TrailSelect;

export type TrailOption = Prisma.TrailGetPayload<{ select: typeof optionSelect }>;

export function listPlannableTrails(): Promise<TrailOption[]> {
	return prisma.trail.findMany({ where: realTrailWhere, orderBy: [{ title: 'asc' }, { id: 'asc' }], select: optionSelect });
}
