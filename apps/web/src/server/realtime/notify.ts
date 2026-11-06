import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getIO } from './io';

type NotifyInput = {
	userId: string;
	message: string;
	type: NotificationType;
	targetId?: string;
};

export async function notify({ userId, message, type, targetId }: NotifyInput) {
	const notification = await prisma.notification.create({
		data: {
			userId,
			message,
			type,
			targetId,
		},
	});

	getIO()?.to(`user:${userId}`).emit('notification', notification);
	return notification;
}
