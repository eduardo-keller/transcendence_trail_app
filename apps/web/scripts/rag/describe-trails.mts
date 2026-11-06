// Gera com o Gemini uma descrição em texto corrido de cada trilha real do catálogo, a partir SÓ dos dados
// do OpenStreetMap (distância, desnível, piso…) e da região calculada pela coordenada. Grava em
// prisma/data/rag/trilhas.json, que entra no corpus do RAG. Não muda o Trail.description do catálogo.
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/rag/describe-trails.mts
//      ... --mostrar    só imprime o prompt do primeiro lote (não chama a API)
//      ... --refazer    descreve de novo todas (sem ele, mantém as que já estão no arquivo)
//
// Gasta 1 pedido por lote de 10 trilhas (~9 no total). Revise o arquivo gerado antes de indexar.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createGoogle } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const DATA = join(import.meta.dirname, '..', '..', 'prisma', 'data');
const SQLITE_PATH = join(DATA, 'trilhas_20261007.sqlite');
const OUT = join(DATA, 'rag', 'trilhas.json');
const MODEL = process.env.LLM_MODEL || 'gemini-3.5-flash-lite';
const BATCH_SIZE = 10;

// Mesmo critério de src/server/ai/trails.ts (o node não resolve o alias @/)
const MIN_DISTANCE_KM = 0.5;
const REAL_TRAIL_NAME = /trilha|caminho|pico|cachoeira|pedra/i;

// Região pelo ponto inicial: a primeira da lista que contém o ponto vale (das menores para as maiores).
// Retângulos aproximados, desenhados a partir das coordenadas das trilhas; por isso a descrição diz
// "na região de", nunca "dentro do parque".
const REGIONS: { name: string; south: number; north: number; west: number; east: number }[] = [
	{ name: 'Parque Ibirapuera, na zona sul da cidade de São Paulo', south: -23.596, north: -23.578, west: -46.668, east: -46.648 },
	{ name: 'Parque Ecológico do Tietê, na zona leste da cidade de São Paulo', south: -23.51, north: -23.48, west: -46.545, east: -46.505 },
	{ name: 'Horto Florestal (Parque Estadual Alberto Löfgren), na zona norte de São Paulo, ao pé da Serra da Cantareira', south: -23.468, north: -23.446, west: -46.645, east: -46.625 },
	{ name: 'Pico do Jaraguá (Parque Estadual do Jaraguá), na zona noroeste da cidade de São Paulo', south: -23.476, north: -23.445, west: -46.8, east: -46.745 },
	{ name: 'Pedra Grande de Atibaia (Monumento Natural Estadual da Pedra Grande)', south: -23.175, north: -23.13, west: -46.56, east: -46.51 },
	{ name: 'Parque Estadual do Juquery, em Franco da Rocha', south: -23.36, north: -23.31, west: -46.73, east: -46.68 },
	{ name: 'Paranapiacaba, em Santo André, no alto da Serra do Mar', south: -23.82, north: -23.72, west: -46.39, east: -46.22 },
	{ name: 'Reserva Florestal do Morro Grande e Caucaia do Alto, em Cotia', south: -23.81, north: -23.64, west: -47.02, east: -46.92 },
	{ name: 'parques naturais municipais de Parelheiros (Itaim, Varginha e Jaceguava), no extremo sul da cidade de São Paulo', south: -23.83, north: -23.78, west: -46.78, east: -46.66 },
	{ name: 'Perus e Parque Anhanguera, no noroeste da cidade de São Paulo', south: -23.445, north: -23.38, west: -46.83, east: -46.74 },
	{ name: 'Serra da Cantareira (Parque Estadual da Cantareira e arredores), no norte da Grande São Paulo', south: -23.445, north: -23.33, west: -46.72, east: -46.5 },
	{ name: 'Mairiporã e Atibaia, ao norte da Serra da Cantareira', south: -23.33, north: -23.18, west: -46.7, east: -46.5 },
	{ name: 'Serra do Mar no ABC paulista (São Bernardo do Campo e Santo André)', south: -23.88, north: -23.76, west: -46.47, east: -46.39 },
	{ name: 'Ribeirão Pires e Rio Grande da Serra, no ABC paulista', south: -23.76, north: -23.62, west: -46.46, east: -46.33 },
	{ name: 'Serra do Mar entre São Bernardo do Campo e Cubatão', south: -24.0, north: -23.88, west: -46.6, east: -46.5 },
	{ name: 'extremo sul da cidade de São Paulo (Parelheiros e Marsilac), perto da Serra do Mar', south: -24.05, north: -23.9, west: -46.8, east: -46.6 },
	{ name: 'zona oeste da cidade de São Paulo, na região do Butantã', south: -23.6, north: -23.53, west: -46.76, east: -46.68 },
	{ name: 'Cotia e Embu das Artes, a oeste de São Paulo', south: -23.66, north: -23.58, west: -46.9, east: -46.8 },
	{ name: 'Embu-Guaçu, Itapecerica da Serra e Cotia, a sudoeste de São Paulo', south: -23.83, north: -23.66, west: -46.92, east: -46.8 },
	{ name: 'Juquitiba, São Lourenço da Serra e Embu-Guaçu, no sudoeste da Grande São Paulo', south: -24.06, north: -23.83, west: -47.1, east: -46.8 },
	{ name: 'Pirapora do Bom Jesus e Santana de Parnaíba, a oeste de São Paulo', south: -23.45, north: -23.33, west: -47.06, east: -46.88 },
	{ name: 'entre Atibaia e Jarinu, no norte da região', south: -23.18, north: -23.0, west: -46.8, east: -46.6 },
];
const FALLBACK_REGION = 'Grande São Paulo e arredores';

export function regionOf(lat: number | null, lon: number | null): string {
	if (lat === null || lon === null) return FALLBACK_REGION;
	const region = REGIONS.find((r) => lat >= r.south && lat <= r.north && lon >= r.west && lon <= r.east);
	return region?.name ?? FALLBACK_REGION;
}

// Valores do OSM em português: o modelo erra menos traduzindo menos
const SURFACE: Record<string, string> = {
	dirt: 'terra',
	ground: 'terra',
	earth: 'terra',
	unpaved: 'sem pavimento',
	mud: 'lama',
	grass: 'grama',
	gravel: 'cascalho',
	wood: 'madeira',
	asphalt: 'asfalto',
	paved: 'pavimentado',
	paving_stones: 'bloquetes',
};
const HIGHWAY: Record<string, string> = {
	path: 'trilha estreita',
	track: 'estrada de terra ou trilha larga',
	footway: 'caminho de pedestres',
};
const VISIBILITY: Record<string, string> = {
	excellent: 'excelente',
	good: 'boa',
	intermediate: 'intermediária',
	bad: 'ruim',
	horrible: 'muito ruim',
	no: 'sem marcação visível',
};
const SAC: Record<string, string> = {
	hiking: 'T1 (caminhada)',
	mountain_hiking: 'T2 (caminhada de montanha)',
	demanding_mountain_hiking: 'T3 (caminhada de montanha exigente)',
	alpine_hiking: 'T4 (caminhada alpina)',
};
const DIFFICULTY: Record<string, string> = { facil: 'fácil', moderada: 'moderada', dificil: 'difícil' };

type Row = Record<string, string | number | null>;

const translate = (value: string | number | null, table: Record<string, string>) =>
	typeof value === 'string' && value
		? value
				.split(/[,;]\s*/)
				.map((part) => table[part] ?? part)
				.join(', ')
		: null;

const km = (value: number) => `${value.toFixed(1).replace('.', ',')} km`;

function minutes(value: string | number | null) {
	const match = typeof value === 'string' ? value.match(/^(\d+)h(\d{1,2})$/) : null;
	if (!match) return null;
	const h = Number(match[1]);
	return h > 0 ? `${h} h ${match[2]} min` : `${Number(match[2])} min`;
}

// Os fatos de uma trilha, em linhas "campo: valor". Também vão para o arquivo (e para o corpus) como estão.
export function trailFacts(row: Row) {
	const gain = Number(row.ganho_m) || 0;
	const loss = Number(row.perda_m) || 0;
	const allowed = ['foot', 'bicycle', 'horse', 'dog']
		.filter((tag) => row[tag] === 'yes' || row[tag] === 'no')
		.map((tag) => `${{ foot: 'a pé', bicycle: 'bicicleta', horse: 'cavalo', dog: 'cachorro' }[tag]}: ${row[tag] === 'yes' ? 'sim' : 'não'}`);
	return [
		`Distância medida: ${km(Number(row.km_total))}, ${row.circular === 'sim' ? 'circular (volta ao início)' : 'só ida (não é circular)'}`,
		gain || loss ? `Desnível estimado na ida: sobe ${Math.round(gain)} m e desce ${Math.round(loss)} m` : 'Desnível: sem dado',
		minutes(row.tempo_est_calc) ? `Tempo estimado do percurso medido: ${minutes(row.tempo_est_calc)}` : null,
		`Dificuldade estimada: ${DIFFICULTY[String(row.dificuldade_calc)] ?? 'sem dado'}`,
		translate(row.highway, HIGHWAY) ? `Tipo de caminho: ${translate(row.highway, HIGHWAY)}` : null,
		translate(row.surface, SURFACE) ? `Piso: ${translate(row.surface, SURFACE)}` : null,
		translate(row.sac_scale, SAC) ? `Escala SAC: ${translate(row.sac_scale, SAC)}` : null,
		translate(row.trail_visibility, VISIBILITY) ? `Visibilidade da trilha: ${translate(row.trail_visibility, VISIBILITY)}` : null,
		row.access === 'permit' ? 'Acesso: exige autorização' : row.access === 'private' ? 'Acesso: particular' : null,
		allowed.length > 0 ? `Permitido no OSM: ${allowed.join('; ')}` : null,
		row.width ? `Largura (m, OSM): ${row.width}` : null,
		row.operator ? `Administração: ${row.operator}` : null,
		// Às vezes a descrição do OSM repete o nome: aí não acrescenta nada
		row.description && row.description !== row.nome ? `Descrição no OSM: ${row.description}` : null,
	].filter((line) => line !== null);
}

const SYSTEM = `Você escreve descrições curtas de trilhas para o Trilhas SP, um app de trilhas de São Paulo.
Cada descrição vai para a base de um assistente que responde perguntas de usuários sobre as trilhas.

Regras:
- Use SÓ os dados de cada trilha. Informação falsa sobre um lugar real é um problema de segurança.
- Comece pelo nome da trilha e diga que ela fica na região indicada (escreva "na região de…", porque a região é aproximada).
- Pelo nome, você pode dizer o que ele afirma literalmente, deixando claro que vem do nome: "Trilha da Cachoeira do Funil" → "pelo nome, leva a uma cachoeira"; "Pico" → leva a um pico; "Pedra" → a uma formação de pedra. Nada além disso.
- Nunca invente: água no caminho, banheiro, estacionamento, sinal de celular, segurança, mirante ou vista, fauna, flora, horário, preço, estado da trilha.
- Diga uma vez que distância, desnível e tempo são estimativas a partir do OpenStreetMap. Desnível "sem dado": diga que não há dado de desnível.
- Se a trilha não for circular, lembre que a volta pelo mesmo caminho dobra a distância e inverte a subida e a descida.
- Se o nome citar uma distância diferente da medida (ex.: "Trilha 6 km" com 1,1 km), diga: "O nome cita 6 km, mas o trecho medido no OpenStreetMap é só uma parte desse percurso".
- Português do Brasil, texto corrido, um parágrafo de 60 a 110 palavras, sem markdown e sem listas.`;

const outputSchema = z.object({
	trilhas: z.array(z.object({ id: z.string(), descricao: z.string() })),
});

type TrailEntry = {
	externalId: string;
	title: string;
	region: string;
	facts: string[];
	description: string;
};

function readTrails(): Omit<TrailEntry, 'description'>[] {
	const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });
	try {
		const rows = db.prepare('SELECT * FROM trilhas ORDER BY trilha_id').all() as Row[];
		return rows
			.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value])) as Row)
			.filter((row) => Number(row.km_total) >= MIN_DISTANCE_KM && REAL_TRAIL_NAME.test(String(row.nome)))
			.map((row) => ({
				externalId: String(row.trilha_id),
				title: String(row.nome),
				region: regionOf(row.inicio_lat as number | null, row.inicio_lon as number | null),
				facts: trailFacts(row),
			}));
	} finally {
		db.close();
	}
}

function promptFor(batch: Omit<TrailEntry, 'description'>[]) {
	const blocks = batch.map(
		(trail) => `<trilha id="${trail.externalId}">\nNome: ${trail.title}\nRegião: ${trail.region}\n${trail.facts.join('\n')}\n</trilha>`,
	);
	return `Escreva uma descrição para cada trilha abaixo. Devolva o mesmo id de cada uma.\n\n${blocks.join('\n\n')}`;
}

// Palavras que o modelo não deveria usar sem o nome dizer: marcadas para revisão humana
const SUSPICIOUS = /água potável|banheiro|estacionamento|sinal de celular|mirante|vista|segura|perigos|bem sinalizada|aves|macacos|cobras|fauna|flora|ingresso|gratuit/i;

function readKey(): string {
	const key = process.env.GEMINI_API_KEY || (existsSync('/run/secrets/gemini_api_key') ? readFileSync('/run/secrets/gemini_api_key', 'utf8').trim() : '');
	if (!key) {
		console.error('Sem chave: cole a chave do Gemini em docker/secrets/gemini_api_key.txt.');
		process.exit(1);
	}
	return key;
}

const trails = readTrails();
const previous: TrailEntry[] =
	existsSync(OUT) && !process.argv.includes('--refazer') ? JSON.parse(readFileSync(OUT, 'utf8')).trails : [];
const done = new Map(previous.map((trail) => [trail.externalId, trail.description]));
const pending = trails.filter((trail) => !done.has(trail.externalId));
console.log(`${trails.length} trilhas reais; ${trails.length - pending.length} já descritas; ${pending.length} a descrever com ${MODEL}.`);

if (process.argv.includes('--mostrar')) {
	console.log(`\n--- system ---\n${SYSTEM}\n\n--- prompt ---\n${promptFor(pending.slice(0, BATCH_SIZE))}`);
	process.exit(0);
}

const google = pending.length > 0 ? createGoogle({ apiKey: readKey() }) : null;
const save = () => {
	const entries: TrailEntry[] = trails
		.filter((trail) => done.has(trail.externalId))
		.map((trail) => ({ ...trail, description: done.get(trail.externalId) ?? '' }));
	mkdirSync(join(OUT, '..'), { recursive: true });
	writeFileSync(
		OUT,
		`${JSON.stringify(
			{
				source: 'OpenStreetMap (dataset de 2026-10-07); descrições geradas por IA a partir só destes dados, revisadas pelo time',
				license: 'ODbL (dados do OpenStreetMap)',
				model: MODEL,
				generatedAt: new Date().toISOString().slice(0, 10),
				trails: entries,
			},
			null,
			'\t',
		)}\n`,
	);
};

for (let i = 0; i < pending.length && google; i += BATCH_SIZE) {
	const batch = pending.slice(i, i + BATCH_SIZE);
	try {
		const { output } = await generateText({
			model: google(MODEL),
			system: SYSTEM,
			prompt: promptFor(batch),
			output: Output.object({ schema: outputSchema }),
			maxRetries: 2,
		});
		for (const item of output.trilhas) {
			if (batch.some((trail) => trail.externalId === item.id)) done.set(item.id, item.descricao.trim());
		}
		save(); // grava a cada lote: se a cota acabar no meio, a próxima execução continua daqui
		console.log(`  lote ${i / BATCH_SIZE + 1}: ${output.trilhas.length}/${batch.length} descritas`);
	} catch (error) {
		console.error(`  lote ${i / BATCH_SIZE + 1} falhou: ${error instanceof Error ? error.message.slice(0, 200) : error}`);
		console.error('Rode de novo para continuar de onde parou.');
		process.exit(1);
	}
}

save();
const missing = trails.filter((trail) => !done.has(trail.externalId));
const flagged = trails.filter((trail) => SUSPICIOUS.test(done.get(trail.externalId) ?? ''));
console.log(`\n${done.size} descrições em ${OUT}`);
if (missing.length > 0) console.log(`Sem descrição (rode de novo): ${missing.map((t) => t.externalId).join(', ')}`);
if (flagged.length > 0) console.log(`Para revisar (palavras que o nome não justifica?): ${flagged.map((t) => `${t.externalId} ${t.title}`).join(' · ')}`);
