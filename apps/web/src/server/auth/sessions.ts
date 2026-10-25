import { prisma } from '@/lib/db';

// Sessões ativas de um usuário, sem o token (que nunca vai para o navegador)
export function listSessions(userId: string) {
	return prisma.session.findMany({
		where: { userId, expiresAt: { gt: new Date() } },
		select: { id: true, createdAt: true, updatedAt: true, ipAddress: true, userAgent: true },
		orderBy: { updatedAt: 'desc' },
	});
}

// O dono vai no where do próprio delete: não dá para encerrar a sessão de outra pessoa
export function revokeSession(userId: string, sessionId: string) {
	return prisma.session.deleteMany({ where: { id: sessionId, userId } });
}

export function revokeOtherSessions(userId: string, currentSessionId: string) {
	return prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
}

// "Chrome no Linux" a partir do User-Agent (só para mostrar; não é usado para segurança)
export function describeDevice(userAgent: string | null) {
	if (!userAgent) return 'Dispositivo desconhecido';
	const browser = /Edg\//.test(userAgent)
		? 'Edge'
		: /Firefox\//.test(userAgent)
			? 'Firefox'
			: /Chrome\//.test(userAgent)
				? 'Chrome'
				: /Safari\//.test(userAgent)
					? 'Safari'
					: /curl\//.test(userAgent)
						? 'curl'
						: 'Navegador';
	const os = /Android/.test(userAgent)
		? 'Android'
		: /iPhone|iPad/.test(userAgent)
			? 'iOS'
			: /Windows/.test(userAgent)
				? 'Windows'
				: /Mac OS/.test(userAgent)
					? 'macOS'
					: /Linux/.test(userAgent)
						? 'Linux'
						: '';
	return os ? `${browser} no ${os}` : browser;
}
