import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '@/lib/db';
import type { createActivitySchema, updateActivitySchema } from '@/lib/validation/activity';
import { ApiError, paginate, paginated } from '@/server/api';
import { trailNotFound } from '@/server/trails/service';
import type { ActivityList } from './schemas';

// Atividades são privadas: só o dono lê, altera ou apaga. Para os outros, a atividade não existe (404).

export const activityNotFound = () => new ApiError(404, 'ACTIVITY_NOT_FOUND', 'Atividade não encontrada.');

const activitySelect = {
	id: true,
	title: true,
	distance: true,
	duration: true,
	polyline: true,
	startedAt: true,
	createdAt: true,
	trail: { select: { id: true, title: true } },
} satisfies Prisma.ActivitySelect;

// A trilha vinculada precisa existir e ser visível para o usuário (pública ou dele)
async function findLinkableTrail(trailId: string, userId: string) {
	const trail = await prisma.trail.findFirst({
		where: { id: trailId, OR: [{ visibility: 'PUBLIC' }, { authorId: userId }] },
		select: { id: true, distance: true },
	});
	if (!trail) throw trailNotFound();
	return trail;
}

function trailGoneDuringWrite(error: unknown): never {
	if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw trailNotFound();
	throw error;
}

export async function listActivities(userId: string, filters: ActivityList) {
	const where: Prisma.ActivityWhereInput = {
		userId,
		trailId: filters.trailId,
		startedAt: { gte: filters.from, lte: filters.to },
	};
	const [total, items] = await prisma.$transaction([
		prisma.activity.count({ where }),
		prisma.activity.findMany({
			where,
			select: activitySelect,
			orderBy: [{ startedAt: filters.order }, { id: 'asc' }],
			...paginate(filters),
		}),
	]);
	return paginated(items, total, filters);
}

export async function getActivity(id: string, userId: string) {
	const activity = await prisma.activity.findFirst({ where: { id, userId }, select: activitySelect });
	if (!activity) throw activityNotFound();
	return activity;
}

export async function createActivity(input: z.output<typeof createActivitySchema>, userId: string) {
	const trail = input.trailId ? await findLinkableTrail(input.trailId, userId) : null;
	return prisma.activity.create({
		data: {
			...input,
			// o schema garante: sem distance, há trilha
			distance: input.distance ?? trail?.distance ?? 0,
			userId,
		},
		select: { id: true },
	}).catch(trailGoneDuringWrite);
}

export async function updateActivity(id: string, input: z.output<typeof updateActivitySchema>, userId: string) {
	await getActivity(id, userId);
	if (input.trailId) await findLinkableTrail(input.trailId, userId);
	return prisma.activity
		.update({ where: { id, userId }, data: input, select: { id: true } })
		.catch(trailGoneDuringWrite);
}

export async function deleteActivity(id: string, userId: string) {
	await getActivity(id, userId);
	return prisma.activity.delete({ where: { id, userId }, select: { id: true } });
}

// Estatísticas do perfil: total de atividades, distância (m) e tempo (s)
export async function getActivityStats(userId: string) {
	const stats = await prisma.activity.aggregate({
		where: { userId },
		_count: true,
		_sum: { distance: true, duration: true },
	});
	return { activities: stats._count, distance: stats._sum.distance ?? 0, duration: stats._sum.duration ?? 0 };
}
