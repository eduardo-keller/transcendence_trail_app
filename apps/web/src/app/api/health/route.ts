import { prisma } from '../../../lib/db';

export async function GET() {
  const trails = await prisma.trail.count();
  return Response.json({ ok: true, trails });
}