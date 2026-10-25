import { z } from 'zod';
import { notFound, parseParams, withHandler } from '@/server/api';
import { getAvatar } from '@/server/profile/avatar';

const paramsSchema = z.object({ userId: z.string().min(1).max(64) });

// Avatares são públicos (aparecem no perfil público). A URL leva ?v=, então pode ficar em cache.
export const GET = withHandler(async (_request, { params }: { params: Promise<{ userId: string }> }) => {
	const { userId } = await parseParams(params, paramsSchema);
	const avatar = await getAvatar(userId);
	if (!avatar) throw notFound('Avatar não encontrado.');
	return new Response(avatar.data, {
		headers: {
			'Content-Type': avatar.mime,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
});
