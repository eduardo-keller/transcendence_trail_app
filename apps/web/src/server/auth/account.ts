import { prisma } from '@/lib/db';

// Contas criadas pelo GitHub ou pela 42 não têm senha (não há conta "credential")
export async function hasPassword(userId: string) {
	const count = await prisma.account.count({ where: { userId, providerId: 'credential', password: { not: null } } });
	return count > 0;
}

// Formas de entrar ligadas à conta: 'credential' (senha), 'github', '42'
export async function linkedProviders(userId: string) {
	const accounts = await prisma.account.findMany({ where: { userId }, select: { providerId: true } });
	return accounts.map((account) => account.providerId);
}
