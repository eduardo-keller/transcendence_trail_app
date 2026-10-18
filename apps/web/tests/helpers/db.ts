import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Utilitários dos testes de integração (banco *_test, ver tests/setup/global-setup.ts)

// Esvazia as tabelas de domínio; as demais vão junto pelas cascatas
export async function resetDatabase() {
	await prisma.$executeRaw`TRUNCATE TABLE "User", "Trail", "Community", "Badge", "Verification" CASCADE`;
}

let sequence = 0;

export async function createUser(name = 'Usuário') {
	sequence += 1;
	return prisma.user.create({
		data: { id: `user-${sequence}-${Date.now()}`, name, email: `user-${sequence}-${Date.now()}@example.com` },
	});
}

// Trilha simples num quadrado de 0,01° a partir de (lat, lon)
export async function createTrail(data: Partial<Prisma.TrailUncheckedCreateInput> & { lat?: number; lon?: number } = {}) {
	const { lat = -23.5, lon = -46.6, ...rest } = data;
	return prisma.trail.create({
		data: {
			title: 'Trilha de Teste',
			distance: 1000,
			routeGeoJSON: { type: 'MultiLineString', coordinates: [[[lon, lat], [lon + 0.01, lat + 0.01]]] },
			minLat: lat,
			minLon: lon,
			maxLat: lat + 0.01,
			maxLon: lon + 0.01,
			startLat: lat,
			startLon: lon,
			...rest,
		},
	});
}
