import { prisma } from '@/lib/db';

// O processo está no ar e o banco responde? 200 se sim, 503 se o banco caiu.
export async function GET() {
	const uptime = Math.round(process.uptime());
	const start = performance.now();
	try {
		await prisma.$queryRaw`SELECT 1`;
	} catch (error) {
		console.error('health: banco indisponível', error);
		return Response.json({ status: 'error', db: 'down', uptime }, { status: 503 });
	}
	const latencyMs = Math.round(performance.now() - start);
	return Response.json({ status: 'ok', db: 'up', dbLatencyMs: latencyMs, uptime });
}
