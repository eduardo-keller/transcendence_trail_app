import { prisma } from '@/lib/db';
import { getIO } from './io';

type NotifyInput = { userId: string, message: string};

export async function notify({ userId, message }: NotifyInput) {
    const notification = await prisma.notification.create({ data: {userId, message }});

    getIO()?.to(`user:${userId}`).emit('notification', notification);
    return (notification);
}
