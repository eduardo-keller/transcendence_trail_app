import { parseQuery, withHandler } from '@/server/api';
import { getCurrentUser } from '@/server/api/session';
import { trailSearchSchema } from '@/server/trails/schemas';
import { searchTrails } from '@/server/trails/service';

// Busca de trilhas com filtros, ordenação e paginação.
// Parâmetros e resposta: docs/frentes/trilhas/README.md#api
export const GET = withHandler(async (request) => {
	const filters = parseQuery(request, trailSearchSchema);
	const viewer = await getCurrentUser();
	return Response.json(await searchTrails(filters, viewer?.id ?? null));
});
