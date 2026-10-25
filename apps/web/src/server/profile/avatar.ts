import { prisma } from '@/lib/db';
import { AVATAR_MAX_BYTES, detectImageType } from '@/lib/validation/avatar';
import { badRequest } from '@/server/api';

export async function saveAvatar(userId: string, file: unknown) {
	if (!(file instanceof File) || file.size === 0) throw badRequest('Escolha uma imagem.');
	if (file.size > AVATAR_MAX_BYTES) throw badRequest('Imagem grande demais.');

	const data = new Uint8Array(await file.arrayBuffer());
	const mime = detectImageType(data);
	if (!mime) throw badRequest('O arquivo não é uma imagem JPEG, PNG ou WebP.');

	await prisma.avatar.upsert({ where: { userId }, create: { userId, mime, data }, update: { mime, data } });
	// ?v= muda a cada envio, para o navegador não mostrar a foto antiga do cache
	const image = `/api/avatar/${userId}?v=${Date.now()}`;
	await prisma.user.update({ where: { id: userId }, data: { image } });
	return image;
}

export async function removeAvatar(userId: string) {
	await prisma.avatar.deleteMany({ where: { userId } });
	await prisma.user.update({ where: { id: userId }, data: { image: null } });
}

export function getAvatar(userId: string) {
	return prisma.avatar.findUnique({ where: { userId }, select: { mime: true, data: true } });
}
