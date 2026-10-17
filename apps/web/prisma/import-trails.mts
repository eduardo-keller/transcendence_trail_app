// Importa as trilhas do OpenStreetMap do dataset em prisma/data/*.sqlite para a tabela Trail.
// Idempotente: faz upsert pelo trilha_id (externalId), então pode rodar quantas vezes quiser.
//
// uso: make import-trails                       atualiza todas as trilhas
//      node prisma/import-trails.mts --if-empty  só importa se ainda não houver trilhas do OSM
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const SQLITE_PATH = join(import.meta.dirname, 'data', 'trilhas_20261007.sqlite');
const BATCH_SIZE = 200;

// Tags do OSM sem coluna própria: vão para Trail.osmTags
const OSM_TAGS = [
	'trail_visibility',
	'access',
	'foot',
	'bicycle',
	'horse',
	'dog',
	'wheelchair',
	'incline',
	'width',
	'operator',
	'website',
	'ref',
	'wikidata',
	'wikipedia',
] as const;

const DIFFICULTY = { facil: 'EASY', moderada: 'MODERATE', dificil: 'HARD' } as const;

const jsonString = z.string().transform((text, ctx) => {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		ctx.issues.push({ code: 'custom', message: 'JSON inválido', input: text });
		return z.NEVER;
	}
});

// Coordenadas GeoJSON: [lon, lat]
const geometrySchema = z.object({
	type: z.literal('MultiLineString'),
	coordinates: z.array(z.array(z.array(z.number()).min(2)).min(2)).min(1),
});

const rowSchema = z.object({
	trilha_id: z.string().regex(/^TRL-\d+$/),
	nome: z.string().min(1),
	description: z.string().nullable(),
	km_total: z.number().min(0),
	ganho_m: z.number().nullable(),
	perda_m: z.number().nullable(),
	tempo_est_calc: z.string().nullable(),
	circular: z.enum(['sim', 'nao']),
	dificuldade_calc: z.enum(['facil', 'moderada', 'dificil']),
	inicio_lat: z.number().min(-90).max(90).nullable(),
	inicio_lon: z.number().min(-180).max(180).nullable(),
	surface: z.string().nullable(),
	highway: z.string().nullable(),
	sac_scale: z.string().nullable(),
	ultima_edicao: z.iso.datetime().nullable(),
	geom_geojson: jsonString.pipe(geometrySchema),
});

type Row = z.output<typeof rowSchema>;

// "2h22" → 142
function parseMinutes(value: string | null): number | null {
	const match = value?.match(/^(\d+)h(\d{1,2})$/);
	return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function boundingBox(lines: number[][][]) {
	let minLat = Infinity;
	let minLon = Infinity;
	let maxLat = -Infinity;
	let maxLon = -Infinity;
	for (const line of lines) {
		for (const [lon, lat] of line) {
			minLat = Math.min(minLat, lat);
			minLon = Math.min(minLon, lon);
			maxLat = Math.max(maxLat, lat);
			maxLon = Math.max(maxLon, lon);
		}
	}
	return { minLat, minLon, maxLat, maxLon };
}

// Campo Json precisa de Prisma.DbNull para gravar NULL (undefined no update = "não mexer")
function osmTags(raw: Record<string, unknown>) {
	const tags = Object.fromEntries(
		OSM_TAGS.flatMap((tag) => (typeof raw[tag] === 'string' ? [[tag, raw[tag]]] : [])),
	);
	return Object.keys(tags).length > 0 ? tags : Prisma.DbNull;
}

function toTrail(row: Row, raw: Record<string, unknown>) {
	return {
		source: 'OSM',
		externalId: row.trilha_id,
		title: row.nome,
		description: row.description,
		distance: Math.round(row.km_total * 1000),
		elevationGain: row.ganho_m,
		elevationLoss: row.perda_m,
		estimatedMinutes: parseMinutes(row.tempo_est_calc),
		isCircular: row.circular === 'sim',
		difficulty: DIFFICULTY[row.dificuldade_calc],
		surface: row.surface,
		highway: row.highway,
		sacScale: row.sac_scale,
		osmTags: osmTags(raw),
		routeGeoJSON: row.geom_geojson,
		startLat: row.inicio_lat,
		startLon: row.inicio_lon,
		...boundingBox(row.geom_geojson.coordinates),
		sourceUpdatedAt: row.ultima_edicao ? new Date(row.ultima_edicao) : null,
	} satisfies Prisma.TrailCreateInput;
}

// O dataset usa string vazia para "sem valor"; aqui vira null
function readRows(): Record<string, unknown>[] {
	const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });
	try {
		return db
			.prepare('SELECT * FROM trilhas ORDER BY trilha_id')
			.all()
			.map((row) =>
				Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value])),
			);
	} finally {
		db.close();
	}
}

async function main() {
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
	});
	try {
		if (process.argv.includes('--if-empty')) {
			const existing = await prisma.trail.count({ where: { source: 'OSM' } });
			if (existing > 0) {
				console.log(`import-trails: ${existing} trilhas do OSM já importadas, nada a fazer.`);
				return;
			}
		}

		const trails: ReturnType<typeof toTrail>[] = [];
		const invalid: { id: unknown; issues: string[] }[] = [];
		for (const raw of readRows()) {
			const result = rowSchema.safeParse(raw);
			if (result.success) {
				trails.push(toTrail(result.data, raw));
			} else {
				const issues = result.error.issues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
				invalid.push({ id: raw.trilha_id, issues });
			}
		}

		for (let i = 0; i < trails.length; i += BATCH_SIZE) {
			const batch = trails.slice(i, i + BATCH_SIZE);
			await prisma.$transaction(
				batch.map((trail) =>
					prisma.trail.upsert({
						where: { externalId: trail.externalId },
						create: trail,
						update: trail,
					}),
				),
			);
		}

		console.log(`import-trails: ${trails.length} trilhas importadas/atualizadas, ${invalid.length} inválidas.`);
		for (const { id, issues } of invalid) {
			console.warn(`  ${String(id)}: ${issues.join('; ')}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((error) => {
	console.error('import-trails: falhou', error);
	process.exitCode = 1;
});
