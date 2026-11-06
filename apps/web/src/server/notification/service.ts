import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { usernameTargetIds } from "./routes";

type NotificationRef = { type: NotificationType; targetId: string | null };

export async function usernameMap(
	notifications: NotificationRef[],
): Promise<Map<string, string>> {
	const ids = usernameTargetIds(notifications);
	if (ids.length === 0) return new Map();
	const users = await prisma.user.findMany({
		where: { id: { in: ids } },
		select: { id: true, username: true },
	});
	return new Map(users.map((u) => [u.id, u.username]));
}
