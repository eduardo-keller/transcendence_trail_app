import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/server/api";
import { publicProfileSelect } from "@/server/profile/service";

export type FriendshipStatusView = "none" | "sent" | "received" | "friends";

export function orderedPair(a: string, b: string) {
	return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export async function sendFriendRequest(
	meId: string,
	otherId: string,
): Promise<"requested" | "accepted"> {
	if (meId === otherId) throw badRequest("Você não pode adicionar a si mesmo.");
	const other = await prisma.user.findUnique({
		where: { id: otherId },
		select: { id: true },
	});
	if (!other) throw notFound("Usuário não encontrado.");

	const pair = orderedPair(meId, otherId);
	try {
		await prisma.friendship.create({ data: { ...pair, requesterId: meId } });
		return "requested";
	} catch (error) {
		if (
			!(
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			)
		)
			throw error;
	}

	const { count } = await prisma.friendship.updateMany({
		where: { ...pair, status: "PENDING", requesterId: otherId },
		data: { status: "ACCEPTED" },
	});
	if (count === 0)
		throw conflict("Vocês já são amigos ou o pedido já foi enviado.");
	return "accepted";
}

export async function acceptFriendRequest(meId: string, requesterId: string) {
	const { count } = await prisma.friendship.updateMany({
		where: {
			...orderedPair(meId, requesterId),
			status: "PENDING",
			requesterId,
		},
		data: { status: "ACCEPTED" },
	});
	if (count === 0) throw notFound("Pedido de amizade não encontrado.");
}

export async function declineFriendRequest(meId: string, requesterId: string) {
	const { count } = await prisma.friendship.deleteMany({
		where: {
			...orderedPair(meId, requesterId),
			status: "PENDING",
			requesterId,
		},
	});
	if (count === 0) throw notFound("Pedido de amizade não encontrado.");
}

export async function cancelFriendRequest(meId: string, otherId: string) {
	const { count } = await prisma.friendship.deleteMany({
		where: {
			...orderedPair(meId, otherId),
			status: "PENDING",
			requesterId: meId,
		},
	});
	if (count === 0) throw notFound("Pedido de amizade não encontrado.");
}

export async function removeFriend(meId: string, otherId: string) {
	const { count } = await prisma.friendship.deleteMany({
		where: { ...orderedPair(meId, otherId), status: "ACCEPTED" },
	});
	if (count === 0) throw notFound("Amizade não encontrada.");
}

export async function friendshipStatus(
	meId: string,
	otherId: string,
): Promise<FriendshipStatusView> {
	const row = await prisma.friendship.findUnique({
		where: { userAId_userBId: orderedPair(meId, otherId) },
		select: { status: true, requesterId: true },
	});
	if (!row) return "none";
	if (row.status === "ACCEPTED") return "friends";
	return row.requesterId === meId ? "sent" : "received";
}

const bothSides = {
	userA: { select: publicProfileSelect },
	userB: { select: publicProfileSelect },
} as const;
const mine = (userId: string) => ({
	OR: [{ userAId: userId }, { userBId: userId }],
});

export async function listFriends(userId: string) {
	const rows = await prisma.friendship.findMany({
		where: { status: "ACCEPTED", ...mine(userId) },
		select: bothSides,
		orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
	});
	return rows.map((r) => (r.userA.id === userId ? r.userB : r.userA));
}

export async function listFriendRequests(userId: string) {
	const rows = await prisma.friendship.findMany({
		where: { status: "PENDING", ...mine(userId) },
		select: { requesterId: true, ...bothSides },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
	});
	const other = (r: (typeof rows)[number]) =>
		r.userA.id === userId ? r.userB : r.userA;
	return {
		received: rows.filter((r) => r.requesterId !== userId).map(other),
		sent: rows.filter((r) => r.requesterId === userId).map(other),
	};
}
