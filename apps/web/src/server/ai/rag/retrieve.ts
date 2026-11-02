import { embed } from 'ai';
import { prisma } from '@/lib/db';
import { EMBEDDING_DIMENSIONS, embeddingModel } from '../model';

// Recuperação do RAG (módulo 8): pergunta → embedding → trechos mais parecidos no pgvector.
// O corpus foi indexado com o mesmo modelo e a mesma dimensão (scripts/rag/build-index.mts).

// Quantos trechos vão para o prompt
export const RAG_TOP_K = 5;
// Similaridade de cosseno mínima de um trecho para ele entrar na resposta. Se nenhum passar, a resposta é
// "não encontrei", sem chamar o modelo. Escolhido com scripts/rag/eval.mts (ver o comentário lá).
export const RAG_MIN_SCORE = 0.62;

export type RagHit = {
	chunkId: number;
	documentId: string;
	source: 'TRAIL' | 'WIKIPEDIA' | 'GUIDE';
	title: string;
	url: string | null;
	license: string | null;
	trailId: string | null; // trilha do catálogo (para o link "Planejar esta trilha")
	content: string;
	score: number;
};

// Fonte numerada: o [n] que a resposta cita. Trechos do mesmo documento dividem o mesmo número.
export type RagSourceRef = Pick<RagHit, 'title' | 'url' | 'license' | 'source' | 'trailId' | 'score'> & { n: number };

// RETRIEVAL_QUERY na pergunta e RETRIEVAL_DOCUMENT no corpus: o Gemini otimiza cada lado para a busca
export async function embedQuestion(question: string, abortSignal?: AbortSignal): Promise<number[]> {
	const { embedding } = await embed({
		model: embeddingModel(),
		value: question,
		abortSignal,
		maxRetries: 1,
		providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' } },
	});
	return embedding;
}

// Os k trechos mais próximos. `<=>` é a distância de cosseno do pgvector (0 = mesma direção);
// score = 1 − distância = similaridade de cosseno. Busca exata, sem índice: com ~2.000 linhas leva
// poucos milissegundos, e um índice HNSW (aproximado) só compensaria com dezenas de milhares.
export async function searchChunks(embedding: number[], k = RAG_TOP_K): Promise<RagHit[]> {
	const vector = `[${embedding.join(',')}]`;
	return prisma.$queryRaw<RagHit[]>`
		SELECT c.id AS "chunkId", c.content, d.id AS "documentId", d.source::text AS source, d.title, d.url,
		       d.license, t.id AS "trailId", 1 - (c.embedding <=> ${vector}::vector) AS score
		FROM "RagChunk" c
		JOIN "RagDocument" d ON d.id = c."documentId"
		LEFT JOIN "Trail" t ON t."externalId" = d."trailExternalId" AND t.visibility = 'PUBLIC'
		ORDER BY c.embedding <=> ${vector}::vector
		LIMIT ${k}`;
}

// Numera as fontes por documento, na ordem do melhor trecho de cada um
export function numberSources(hits: RagHit[]) {
	const sources: RagSourceRef[] = [];
	const numbered = hits.map((hit) => {
		let source = sources.find((s) => s.title === hit.title && s.url === hit.url);
		if (!source) {
			source = {
				n: sources.length + 1,
				title: hit.title,
				url: hit.url,
				license: hit.license,
				source: hit.source,
				trailId: hit.trailId,
				score: Math.round(hit.score * 100) / 100,
			};
			sources.push(source);
		}
		return { ...hit, n: source.n };
	});
	return { sources, numbered };
}

export type Retrieval = ReturnType<typeof numberSources>;

// Só os trechos acima do limiar entram. Lista vazia = "não encontrei".
export async function retrieve(
	question: string,
	{ abortSignal, k = RAG_TOP_K, minScore = RAG_MIN_SCORE }: { abortSignal?: AbortSignal; k?: number; minScore?: number } = {},
): Promise<Retrieval> {
	const embedding = await embedQuestion(question, abortSignal);
	const hits = await searchChunks(embedding, k);
	return numberSources(hits.filter((hit) => hit.score >= minScore));
}

// Tamanho do corpus, mostrado na tela ("Base: N trechos de M documentos")
export async function corpusSize() {
	const [chunks, documents] = await Promise.all([prisma.ragChunk.count(), prisma.ragDocument.count()]);
	return { chunks, documents };
}
