import { prisma } from '@/lib/db';
import { notFound } from '@/server/api';

// Todos os dados pessoais de um usuário, em JSON legível (GDPR: "export user data in a readable format").
// Usado pela frente Identidade no "baixar meus dados" e reaproveitável pela exportação de dados (módulo 16).
// Nunca inclui segredos: hash de senha, tokens de sessão ou de OAuth.
// Ao criar um modelo novo ligado a User, acrescente-o aqui.
export async function exportUserData(userId: string) {
	const user = await prisma.$transaction((tx) => tx.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			emailVerified: true,
			image: true,
			createdAt: true,
			updatedAt: true,
			accounts: { select: { providerId: true, createdAt: true } },
			sessions: { select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } },
			trails: {
				select: {
					id: true,
					title: true,
					description: true,
					distance: true,
					elevationGain: true,
					elevationLoss: true,
					difficulty: true,
					visibility: true,
					routeGeoJSON: true,
					createdAt: true,
					updatedAt: true,
				},
			},
			activities: {
				select: {
					id: true,
					title: true,
					distance: true,
					duration: true,
					polyline: true,
					startedAt: true,
					createdAt: true,
					trail: { select: { id: true, title: true } },
				},
			},
			communities: { select: { role: true, community: { select: { id: true, name: true } } } },
			organizedEvents: { select: { id: true, title: true, date: true, community: { select: { name: true } } } },
			eventsJoined: { select: { event: { select: { id: true, title: true, date: true } } } },
			posts: {
				select: { id: true, content: true, mediaUrl: true, createdAt: true, community: { select: { name: true } } },
			},
			notifications: { select: { message: true, isRead: true, createdAt: true } },
			badges: { select: { earnedAt: true, badge: { select: { name: true, description: true } } } },
		},
	}), { isolationLevel: 'RepeatableRead' });
	if (!user) throw notFound('Usuário não encontrado.');

	const {
		accounts,
		sessions,
		trails,
		activities,
		communities,
		organizedEvents,
		eventsJoined,
		posts,
		notifications,
		badges,
		...profile
	} = user;
	return {
		exportedAt: new Date().toISOString(),
		profile,
		accounts,
		sessions,
		trails,
		activities,
		communities: communities.map(({ role, community }) => ({ ...community, role })),
		events: {
			organized: organizedEvents,
			joined: eventsJoined.map(({ event }) => event),
		},
		posts,
		notifications,
		badges: badges.map(({ earnedAt, badge }) => ({ ...badge, earnedAt })),
	};
}
