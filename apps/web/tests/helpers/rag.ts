import { prisma } from '@/lib/db';

// Utilitários dos testes do RAG: vetores feitos à mão em 768 dimensões, para o teste saber de antemão
// a similaridade de cosseno entre a pergunta e cada trecho, sem chamar a API.

export const DIM = 768;

// vector({ 0: 1 }) = eixo 0; vector({ 0: 0.8, 1: 0.6 }) tem similaridade 0,8 com o eixo 0
export function vector(entries: Record<number, number>) {
	const v = new Array(DIM).fill(0);
	for (const [i, value] of Object.entries(entries)) v[Number(i)] = value;
	return v;
}

export async function clearRag() {
	await prisma.$executeRaw`TRUNCATE TABLE "RagDocument" CASCADE`;
}

export async function addRagDocument(
	document: { id: string; source: 'TRAIL' | 'WIKIPEDIA' | 'GUIDE'; title: string; url?: string; license?: string; trailExternalId?: string },
	chunks: { content: string; embedding: number[] }[],
) {
	await prisma.ragDocument.create({
		data: {
			id: document.id,
			source: document.source,
			title: document.title,
			url: document.url ?? null,
			license: document.license ?? null,
			trailExternalId: document.trailExternalId ?? null,
		},
	});
	for (const chunk of chunks) {
		const literal = `[${chunk.embedding.join(',')}]`;
		await prisma.$executeRaw`INSERT INTO "RagChunk" ("documentId", content, embedding) VALUES (${document.id}, ${chunk.content}, ${literal}::vector)`;
	}
}
