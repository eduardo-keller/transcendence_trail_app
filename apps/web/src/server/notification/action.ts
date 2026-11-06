"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { getIO } from "@/server/realtime/io";
import { notify } from "@/server/realtime/notify";
import { notificationHref } from "./routes";
import { usernameMap } from "./service";

export async function markAllAsRead() {
	const user = await requireUser();

	await prisma.notification.updateMany({
		where: { userId: user.id, isRead: false },
		data: { isRead: true },
	});
	getIO()?.to(`user:${user.id}`).emit("notification:read");
	revalidatePath("/", "layout");
}

export async function sendTestNotification() {
	const user = await requireUser();
	await notify({
		userId: user.id,
		message: "Teste",
		type: "GENERAL",
		targetId: "",
	});
	revalidatePath("/", "layout");
}

export async function openNotification(id: string) {
	const user = await requireUser();

	if (typeof id !== "string") return;

	const notification = await prisma.notification.findFirst({
		where: { id, userId: user.id },
		select: { type: true, targetId: true, isRead: true },
	});

	if (!notification) return;

	if (!notification.isRead) {
		await prisma.notification.update({ where: { id }, data: { isRead: true } });
		getIO()?.to(`user:${user.id}`).emit("notification:read");
		revalidatePath("/", "layout");
	}

	const href = notificationHref(
		notification,
		await usernameMap([notification]),
	);
	if (href) redirect(href);
}

/*
userId: string,
message: string,
type: NotificationType,
targetId?: string
*/
