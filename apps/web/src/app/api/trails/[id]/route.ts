import { parseParams, withHandler } from '@/server/api';
import { getCurrentUser } from '@/server/api/session';
import { trailIdSchema } from '@/server/trails/schemas';
import { getTrail } from '@/server/trails/service';

// Detalhe da trilha, com o percurso (routeGeoJSON). Privada de outra pessoa → 404.
export const GET = withHandler(async (_request, { params }: { params: Promise<{ id: string }> }) => {
	const { id } = await parseParams(params, trailIdSchema);
	const viewer = await getCurrentUser();
	return Response.json(await getTrail(id, viewer?.id ?? null));
});
