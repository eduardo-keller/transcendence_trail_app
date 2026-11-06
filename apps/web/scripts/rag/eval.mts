// Avalia a busca do RAG com o índice carregado no banco: 20 perguntas com o documento que deveria
// aparecer e 5 fora do tema. Mede o acerto@5 (o documento certo entre os 5 primeiros trechos) e mostra
// os scores, para escolher o limiar de "não encontrei" (RAG_MIN_SCORE em src/server/ai/rag/retrieve.ts).
// Gasta 1 pedido de embeddings (as 25 perguntas num lote).
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/rag/eval.mts
//
// A consulta repete a de src/server/ai/rag/retrieve.ts (o node não resolve o alias @/ de src/).
import { existsSync, readFileSync } from 'node:fs';
import { createGoogle } from '@ai-sdk/google';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { embedMany } from 'ai';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const TOP_K = 5;

// Cada pergunta acerta se QUALQUER um dos documentos esperados aparecer entre os 5 primeiros trechos
const QUESTIONS: { question: string; expected: string[] }[] = [
	{ question: 'Qual é o ponto mais alto da cidade de São Paulo?', expected: ['wiki:Pico do Jaraguá'] },
	{ question: 'Como subir ao Pico do Jaraguá a pé?', expected: ['wiki:Pico do Jaraguá', 'trail:TRL-241989821'] },
	{ question: 'Quais animais vivem na Serra da Cantareira?', expected: ['wiki:Parque Estadual da Cantareira', 'wiki:Serra da Cantareira'] },
	{ question: 'O que é a vila de Paranapiacaba?', expected: ['wiki:Paranapiacaba'] },
	{ question: 'Qual a altitude da Pedra Grande de Atibaia?', expected: ['wiki:Monumento Natural Estadual da Pedra Grande', 'trail:TRL-462114253'] },
	{ question: 'Tem alguma trilha com cachoeira em Paranapiacaba?', expected: ['trail:TRL-573342561'] },
	{ question: 'O que fazer se uma cobra me picar na trilha?', expected: ['guide:animais-peconhentos', 'wiki:Bothrops', 'wiki:Lista de cobras peçonhentas do Brasil'] },
	{ question: 'Como tirar um carrapato do corpo?', expected: ['guide:carrapatos-e-febre-maculosa', 'wiki:Febre maculosa', 'wiki:Amblyomma cajennense'] },
	{ question: 'Preciso tomar vacina para fazer trilha na mata?', expected: ['guide:febre-amarela-e-vacinas', 'wiki:Febre amarela'] },
	{ question: 'O que levar numa trilha de um dia?', expected: ['guide:o-que-levar'] },
	{ question: "O que é cabeça d'água e como perceber que ela está vindo?", expected: ['guide:chuva-raios-e-cabeca-dagua'] },
	{ question: 'Quanta água devo levar numa caminhada?', expected: ['guide:agua-e-hidratacao'] },
	{ question: 'O que fazer se eu me perder na mata?', expected: ['guide:se-perder'] },
	{ question: 'Qual a melhor época do ano para fazer trilha em São Paulo?', expected: ['guide:clima-em-sao-paulo', 'wiki:Clima da cidade de São Paulo'] },
	{ question: 'O que significa a escala SAC de dificuldade?', expected: ['guide:escala-sac'] },
	{ question: 'Como é o bugio e o que ele come?', expected: ['wiki:Bugio-ruivo'] },
	{ question: 'Posso levar meu cachorro para fazer trilha?', expected: ['guide:trilha-com-cachorro'] },
	{ question: 'Quem vive na Terra Indígena Jaraguá?', expected: ['wiki:Terra Indígena Jaraguá'] },
	{ question: 'O que foi a Estrada de Ferro Perus-Pirapora?', expected: ['wiki:Estrada de Ferro Perus-Pirapora'] },
	{ question: 'O que é a Calçada do Lorena?', expected: ['wiki:Calçada do Lorena'] },
];
const OFF_TOPIC = [
	'Qual é a capital da França?',
	'Como faço um bolo de chocolate?',
	'Quem ganhou a Copa do Mundo de 2002?',
	'Qual é a cotação do dólar hoje?',
	'Como configuro um roteador wi-fi?',
];

function databaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const password = readFileSync('/run/secrets/db_password', 'utf8').trim();
	return `postgresql://${process.env.POSTGRES_USER}:${password}@postgres:5432/${process.env.POSTGRES_DB}?schema=public`;
}

function readKey(): string {
	const file = '/run/secrets/gemini_api_key';
	const key = process.env.GEMINI_API_KEY || (existsSync(file) ? readFileSync(file, 'utf8').trim() : '');
	if (!key) {
		console.error('Sem chave: cole a chave do Gemini em docker/secrets/gemini_api_key.txt.');
		process.exit(1);
	}
	return key;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
const google = createGoogle({ apiKey: readKey() });

type Hit = { documentId: string; score: number };

async function search(embedding: number[]): Promise<Hit[]> {
	const vector = `[${embedding.join(',')}]`;
	return prisma.$queryRaw<Hit[]>`
		SELECT c."documentId", 1 - (c.embedding <=> ${vector}::vector) AS score
		FROM "RagChunk" c ORDER BY c.embedding <=> ${vector}::vector LIMIT ${TOP_K}`;
}

try {
	const chunks = await prisma.ragChunk.count();
	if (chunks === 0) throw new Error('índice vazio: rode make index-rag antes');
	const all = [...QUESTIONS.map((q) => q.question), ...OFF_TOPIC];
	const { embeddings } = await embedMany({
		model: google.embedding(EMBEDDING_MODEL),
		values: all,
		maxRetries: 2,
		providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' } },
	});

	console.log(`Índice: ${chunks} trechos.\n\nPerguntas do tema (rank do documento certo · score do 1º trecho · documento do 1º trecho)`);
	const topScores: number[] = [];
	const rightScores: number[] = [];
	let hits = 0;
	for (const [i, { question, expected }] of QUESTIONS.entries()) {
		const results = await search(embeddings[i]);
		const rank = results.findIndex((r) => expected.includes(r.documentId));
		if (rank >= 0) {
			hits += 1;
			rightScores.push(results[rank].score);
		}
		topScores.push(results[0].score);
		console.log(`  ${rank >= 0 ? `✔ ${rank + 1}º` : '✘ --'}  ${results[0].score.toFixed(3)}  ${question}  → ${results[0].documentId}`);
	}

	console.log('\nFora do tema (score do 1º trecho · documento)');
	const offScores: number[] = [];
	for (const [j, question] of OFF_TOPIC.entries()) {
		const [top] = await search(embeddings[QUESTIONS.length + j]);
		offScores.push(top.score);
		console.log(`  ${top.score.toFixed(3)}  ${question}  → ${top.documentId}`);
	}

	const minRight = Math.min(...rightScores);
	const minTop = Math.min(...topScores);
	const maxOff = Math.max(...offScores);
	console.log(`\nAcerto@${TOP_K}: ${hits}/${QUESTIONS.length} (${Math.round((hits / QUESTIONS.length) * 100)}%; meta: 80%)`);
	console.log(`Score do 1º trecho: do tema, mínimo ${minTop.toFixed(3)}; fora do tema, máximo ${maxOff.toFixed(3)}`);
	console.log(`Score do documento certo, mínimo: ${minRight.toFixed(3)}`);
	console.log(
		maxOff < minTop
			? `Limiar separa os dois grupos entre ${maxOff.toFixed(3)} e ${minTop.toFixed(3)} (meio: ${((maxOff + minTop) / 2).toFixed(3)})`
			: 'Os grupos se sobrepõem: nenhum limiar separa todos; escolha priorizando não inventar resposta',
	);
} finally {
	await prisma.$disconnect();
}
