import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiError } from '@/server/api';

// O que qualquer pessoa pode ver de um perfil. Sem e-mail, de propósito.
export const publicProfileSelect = {
	id: true,
	name: true,
	username: true,
	bio: true,
	image: true,
	createdAt: true,
} satisfies Prisma.UserSelect;

export function getPublicProfile(username: string) {
	return prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: publicProfileSelect });
}

export async function updateProfile(userId: string, data: { name: string; username: string; bio?: string | null }) {
	try {
		return await prisma.user.update({ where: { id: userId }, data, select: publicProfileSelect });
	} catch (error) {
		// Quem garante a unicidade é o banco (@unique), não uma consulta antes
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			throw new ApiError(409, 'USERNAME_TAKEN', 'Esse nome de usuário já está em uso.');
		}
		throw error;
	}
}
