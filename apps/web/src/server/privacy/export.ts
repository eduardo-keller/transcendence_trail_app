import { prisma } from '@/lib/db';
import { exportUserData } from '@/server/gdpr/export';

// "Baixar meus dados": a exportação do Gabs + o que é da conta (perfil, avatar, 2FA).
// Nunca inclui segredos (hash de senha, tokens, segredo do 2FA).
export async function buildDataExport(userId: string) {
	const base = await exportUserData(userId);
	const extra = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { username: true, bio: true, twoFactorEnabled: true, avatar: { select: { mime: true, data: true, updatedAt: true } } },
	});
	return {
		...base,
		profile: { ...base.profile, username: extra.username, bio: extra.bio, twoFactorEnabled: !!extra.twoFactorEnabled },
		avatar: extra.avatar
			? { mime: extra.avatar.mime, updatedAt: extra.avatar.updatedAt, base64: Buffer.from(extra.avatar.data).toString('base64') }
			: null,
	};
}
