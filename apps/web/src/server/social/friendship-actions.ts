'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { parseWith, withAction } from '@/server/api';
import { requireUser } from '@/server/auth/session';
import { getIO } from '@/server/realtime/io';
import { notify } from '@/server/realtime/notify';
import {
	acceptFriendRequest,
	cancelFriendRequest,
	declineFriendRequest,
	removeFriend,
	sendFriendRequest,
} from './friendship';
import { userIdSchema } from './schemas';

function otherId(userId: unknown) {
	return (parseWith(userIdSchema, { userId }).userId);
}

function changed(a: string, b:string) {
	for (const id of [a, b]) getIO()?.to(`user:${id}`).emit('friendship:changed');
	revalidatePath('/', 'layout');
}

export const sendFriendRequestAction = withAction(async (userId: string) => {
	const user = await requireUser();
	const other = otherId(userId);
	const result = await sendFriendRequest(user.id, other);
	if (result === 'requested') {
		await notify({
			userId: other,
			message: `${user.name} quer ser seu amigo.`,
			type: 'FRIEND_REQUEST',
			targetId: user.id,
		});
	} else {
		await notify({
			userId:other,
			message:`${user.name} aceitou seu pedido de amizade.`,
			type: 'FRIEND_ACCEPTED',
			targetId: user.id,
		});
	}
	changed(user.id, other);
	return result;
});

export const acceptFriendRequestAction = withAction(async (userId: string) => {
	const user = await requireUser();
	const other = otherId(userId);
	await acceptFriendRequest(user.id, other);
	await notify({
		userId: other,
		message: `${user.name} aceitou seu pedido de amizade.`,
		type: 'FRIEND_ACCEPTED',
		targetId: user.id,
	});
	changed(user.id, other);
	return null;
});

export const declineFriendRequestAction = withAction(async (userId: string) => {
	const user = await requireUser();
	const other = otherId(userId);
	await declineFriendRequest(user.id, other);
	await notify({
		userId: other,
		message: `${user.name} recusou seu pedido de amizade.`,
		type: 'FRIEND_DECLINED',
		targetId: user.id,
	});
	changed(user.id, other);
	return null;
});

export const cancelFriendRequestAction = withAction(async (userId: string) => {
	const user = await requireUser();
	const other = otherId(userId);
	await cancelFriendRequest(user.id, other);
	changed(user.id, other);
	return null;
});

export const removeFriendAction = withAction(async (userId: string) => {
	const user = await requireUser();
	const other = otherId(userId);
	await removeFriend(user.id, other);
	const friend = await prisma.user.findUnique({
		where: { id: other },
		select: { name: true },
	});
	await notify({
		userId: user.id,
		message: `Você desfez a amizade com ${friend?.name ?? 'um usuário'}.`,
		type: 'FRIEND_REMOVED',
		targetId: other,
	});
	changed(user.id, other);
	return null;
});
