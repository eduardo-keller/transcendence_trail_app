// Monta o índice do RAG: junta o corpus (Wikipedia, trilhas, guias), corta em trechos e calcula o embedding
// de cada trecho com o Gemini. Grava prisma/data/rag/index.jsonl (versionado), que prisma/index-rag.mts
// carrega no banco sem chamar a API. Rode de novo depois de mudar o corpus: só os trechos novos ou
// alterados gastam cota; se a cota acabar no meio, a próxima execução continua de onde parou.
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/rag/build-index.mts
//      ... --mostrar    só mostra quantos documentos e trechos sairiam, e um exemplo (não chama a API)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createGoogle } from '@ai-sdk/google';
import { APICallError, embedMany, RetryError } from 'ai';

const RAG_DIR = join(import.meta.dirname, '..', '..', 'prisma', 'data', 'rag');
const INDEX = join(RAG_DIR, 'index.jsonl');

// Iguais a src/server/ai/model.ts (o corpus e a pergunta precisam do mesmo modelo e dimensão)
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

// Trecho de ~800 caracteres: grande o bastante para ter contexto, pequeno o bastante para o embedding
// representar um assunto só. A sobreposição evita perder uma ideia cortada no meio.
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;
// Documento até 1,5 × o tamanho fica inteiro (uma trilha, um artigo curto): cortar só atrapalharia
const SINGLE_CHUNK_MAX = CHUNK_SIZE * 1.5;

// O Google aceita até 100 textos por pedido de lote. Entre lotes, uma pausa; num 429 (limite por minuto da
// camada gratuita), espera um minuto e tenta o mesmo lote de novo
const BATCH_SIZE = 100;
const PAUSE_MS = 3000;
const RATE_LIMIT_WAIT_MS = 65_000;
const MAX_RATE_LIMIT_WAITS = 10;

export type RagSource = 'TRAIL' | 'WIKIPEDIA' | 'GUIDE';

export type CorpusDocument = {
	id: string;
	source: RagSource;
	title: string;
	url: string | null;
	license: string | null;
	trailExternalId: string | null;
	text: string;
};

// ---------- trechos ----------

// Título de seção da Wikipedia ("História", "Fauna e flora"): curto e sem pontuação no fim
const isHeading = (line: string) => line.length < 80 && !/[.!?:;,)"”]$/.test(line);

// Divide em pedaços de no máximo `size`: por frases e, se uma frase for maior, por palavras
function splitLong(text: string, size: number): string[] {
	const sentences = text.split(/(?<=[.!?…])\s+/);
	const pieces: string[] = [];
	let current = '';
	for (const sentence of sentences.flatMap((s) => (s.length > size ? splitWords(s, size) : [s]))) {
		if (current && current.length + 1 + sentence.length > size) {
			pieces.push(current);
			current = sentence;
		} else {
			current = current ? `${current} ${sentence}` : sentence;
		}
	}
	if (current) pieces.push(current);
	return pieces;
}

function splitWords(text: string, size: number): string[] {
	const pieces: string[] = [];
	let current = '';
	for (const word of text.split(/\s+/)) {
		if (current && current.length + 1 + word.length > size) {
			pieces.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) pieces.push(current);
	return pieces;
}

// Parágrafos (uma linha cada), com o título de seção grudado no parágrafo seguinte
function paragraphs(text: string, size: number): string[] {
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	const units: string[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		let unit = lines[i];
		while (isHeading(unit.split('\n').at(-1) ?? '') && i + 1 < lines.length) unit = `${unit}\n${lines[++i]}`;
		units.push(...(unit.length > size ? splitLong(unit, size) : [unit]));
	}
	return units;
}

// Fim do trecho anterior que abre o próximo: os últimos ~`overlap` caracteres, começando numa frase
// (ou, se não houver, numa palavra) para não abrir com meia palavra
function overlapTail(text: string, overlap: number): string {
	const piece = text.slice(-overlap);
	const sentence = piece.search(/[.!?]\s+\S/);
	if (sentence >= 0 && piece.length - sentence > overlap / 3) return piece.slice(sentence + 1).trim();
	const space = piece.indexOf(' ');
	return (space >= 0 ? piece.slice(space + 1) : piece).trim();
}

// Corta o texto em trechos de até `size` caracteres, cortando entre parágrafos sempre que dá.
// Cada trecho começa com o título do documento: "e ela é difícil?" não diz de qual trilha, o título diz.
export function chunkText(title: string, text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
	const body = text.trim();
	if (body.length <= size * (SINGLE_CHUNK_MAX / CHUNK_SIZE)) return [`${title}\n\n${body}`];

	const chunks: string[] = [];
	let current = '';
	for (const unit of paragraphs(body, size)) {
		if (current && current.length + 1 + unit.length > size) {
			chunks.push(current);
			const tail = overlapTail(current, overlap);
			current = tail.length + 1 + unit.length <= size ? tail : '';
		}
		current = current ? `${current}\n${unit}` : unit;
	}
	if (current) chunks.push(current);
	return chunks.map((chunk) => `${title}\n\n${chunk}`);
}

// ---------- corpus ----------

type WikipediaFile = { license: string; articles: { title: string; url: string; text: string }[] };
type TrailsFile = { license: string; trails: { externalId: string; title: string; region: string; facts: string[]; description: string }[] };

export function loadCorpus(dir = RAG_DIR): CorpusDocument[] {
	const wikipedia = JSON.parse(readFileSync(join(dir, 'wikipedia.json'), 'utf8')) as WikipediaFile;
	const trails = JSON.parse(readFileSync(join(dir, 'trilhas.json'), 'utf8')) as TrailsFile;
	const guidesDir = join(dir, 'guias');

	const documents: CorpusDocument[] = [
		...wikipedia.articles.map((article) => ({
			id: `wiki:${article.title}`,
			source: 'WIKIPEDIA' as const,
			title: article.title,
			url: article.url,
			license: wikipedia.license,
			trailExternalId: null,
			text: article.text,
		})),
		// A descrição gerada + os fatos como vieram do OSM: se a IA omitiu algum número, o fato continua no trecho
		...trails.trails.map((trail) => ({
			id: `trail:${trail.externalId}`,
			source: 'TRAIL' as const,
			title: trail.title,
			url: null,
			license: trails.license,
			trailExternalId: trail.externalId,
			text: `${trail.description}\nDados do OpenStreetMap (estimados): ${trail.facts.join('; ')}. Região aproximada: ${trail.region}.`,
		})),
		...readdirSync(guidesDir)
			.filter((file) => file.endsWith('.md'))
			.sort()
			.map((file) => {
				const [first, ...rest] = readFileSync(join(guidesDir, file), 'utf8').split('\n');
				return {
					id: `guide:${basename(file, '.md')}`,
					source: 'GUIDE' as const,
					title: first.replace(/^#\s*/, ''),
					url: null,
					license: null,
					trailExternalId: null,
					text: rest.join('\n'),
				};
			}),
	];
	return documents.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------- arquivo do índice ----------

// Vetor em float32 e base64: 4 bytes por número, metade do tamanho do JSON (o pgvector usa float4)
export const encodeVector = (vector: number[]) => Buffer.from(new Float32Array(vector).buffer).toString('base64');
export const decodeVector = (text: string) => Array.from(new Float32Array(new Uint8Array(Buffer.from(text, 'base64')).buffer));

type IndexLine = Omit<CorpusDocument, 'text'> & { chunks: { content: string; embedding: string }[] };

function readIndex(): IndexLine[] {
	if (!existsSync(INDEX)) return [];
	return readFileSync(INDEX, 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as IndexLine);
}

// Uma linha por documento, em ordem de id (diff estável). Só entra documento com todos os trechos calculados.
function writeIndex(documents: (Omit<CorpusDocument, 'text'> & { chunks: string[] })[], known: Map<string, string>) {
	const lines = documents
		.filter((document) => document.chunks.every((content) => known.has(content)))
		.map(({ chunks, ...document }) =>
			JSON.stringify({ ...document, chunks: chunks.map((content) => ({ content, embedding: known.get(content) })) }),
		);
	writeFileSync(INDEX, `${lines.join('\n')}\n`);
	return lines.length;
}

// ---------- execução ----------

function readKey(): string {
	const file = '/run/secrets/gemini_api_key';
	const key = process.env.GEMINI_API_KEY || (existsSync(file) ? readFileSync(file, 'utf8').trim() : '');
	if (!key) {
		console.error('Sem chave: cole a chave do Gemini em docker/secrets/gemini_api_key.txt.');
		process.exit(1);
	}
	return key;
}

async function main() {
	const documents = loadCorpus().map(({ text, ...document }) => ({ ...document, chunks: chunkText(document.title, text) }));
	const all = documents.flatMap((document) => document.chunks);
	// Embeddings já calculados (de qualquer documento), pelo texto do trecho: só o que mudou vai para a API
	const known = new Map(readIndex().flatMap((line) => line.chunks.map((chunk) => [chunk.content, chunk.embedding] as const)));
	const pending = [...new Set(all.filter((content) => !known.has(content)))];

	const bySource = (source: RagSource) => documents.filter((d) => d.source === source);
	console.log(
		`${documents.length} documentos, ${all.length} trechos (Wikipedia ${bySource('WIKIPEDIA').flatMap((d) => d.chunks).length}, ` +
			`trilhas ${bySource('TRAIL').flatMap((d) => d.chunks).length}, guias ${bySource('GUIDE').flatMap((d) => d.chunks).length}); ` +
			`${all.length - pending.length} já calculados, ${pending.length} a calcular.`,
	);
	if (process.argv.includes('--mostrar')) {
		const sizes = all.map((chunk) => chunk.length).sort((a, b) => a - b);
		console.log(`Tamanho dos trechos: mediana ${sizes[Math.floor(sizes.length / 2)]}, máximo ${sizes.at(-1)} caracteres.`);
		console.log(`\nExemplo (${documents[0].id}):\n${documents[0].chunks.slice(0, 2).join('\n---\n')}`);
		return;
	}

	const google = pending.length > 0 ? createGoogle({ apiKey: readKey() }) : null;
	let tokens = 0;
	for (let i = 0; i < pending.length && google; i += BATCH_SIZE) {
		const batch = pending.slice(i, i + BATCH_SIZE);
		for (let waits = 0; ; waits += 1) {
			try {
				const { embeddings, usage } = await embedMany({
					model: google.embedding(EMBEDDING_MODEL),
					values: batch,
					maxParallelCalls: 1,
					maxRetries: 0,
					providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' } },
				});
				for (const [j, embedding] of embeddings.entries()) known.set(batch[j], encodeVector(embedding));
				tokens += usage?.tokens ?? 0;
				break;
			} catch (error) {
				const cause = RetryError.isInstance(error) ? error.lastError : error;
				if (APICallError.isInstance(cause) && cause.statusCode === 429 && waits < MAX_RATE_LIMIT_WAITS) {
					console.log(`  429 (limite do Google): esperando ${RATE_LIMIT_WAIT_MS / 1000} s…`);
					await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
					continue;
				}
				const saved = writeIndex(documents, known);
				console.error(`Lote ${i / BATCH_SIZE + 1} falhou: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
				console.error(`${saved} documentos completos salvos. Rode de novo para continuar de onde parou.`);
				process.exit(1);
			}
		}
		writeIndex(documents, known); // salva a cada lote
		console.log(`  ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} trechos`);
		if (i + BATCH_SIZE < pending.length) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
	}

	const saved = writeIndex(documents, known);
	console.log(`\n${saved} documentos e ${all.length} trechos em ${INDEX}${tokens ? ` (${tokens} tokens nesta execução)` : ''}.`);
	console.log('Para carregar no banco: make index-rag');
}

if (import.meta.main) await main();
