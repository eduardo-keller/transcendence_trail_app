'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth/session';
import { notify } from '@/server/realtime/notify';

export async function markAllAsRead() {
	const user = await requireUser();

	await prisma.notification.updateMany({
		where: { userId: user.id, isRead: false },
		data: { isRead: true },
	});
	revalidatePath('/', 'layout');
}

export async function sendTestNotification() {
	const user = await requireUser();
	await notify({
		userId: user.id,
		message: 'Teste',
		type: 'GENERAL',
		targetId: '',
	});
	revalidatePath('/', 'layout');
}

/*
userId: string,
message: string,
type: NotificationType,
targetId?: string
*/
