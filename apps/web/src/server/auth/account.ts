import { prisma } from '@/lib/db';

// Contas criadas pelo GitHub ou pela 42 não têm senha (não há conta "credential")
export async function hasPassword(userId: string) {
	const count = await prisma.account.count({ where: { userId, providerId: 'credential', password: { not: null } } });
	return count > 0;
}
