// Carrega o índice do RAG (prisma/data/rag/index.jsonl, com os embeddings já calculados) nas tabelas
// RagDocument e RagChunk. Não chama a API do Gemini: um clone novo monta o índice sem chave e sem cota.
// O índice é gerado (com a API) por scripts/rag/build-index.mts e versionado no git.
//
// uso: make index-rag                       recarrega tudo (depois de mudar o corpus e rodar o build-index)
//      node prisma/index-rag.mts --if-empty  só carrega se ainda não houver índice (no start do container)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

const INDEX = join(import.meta.dirname, 'data', 'rag', 'index.jsonl');
// Tem que bater com vector(768) no schema.prisma e com src/server/ai/model.ts
const DIMENSIONS = 768;
const BATCH_SIZE = 100;

type IndexLine = {
	id: string;
	source: 'TRAIL' | 'WIKIPEDIA' | 'GUIDE';
	title: string;
	url: string | null;
	license: string | null;
	trailExternalId: string | null;
	chunks: { content: string; embedding: string }[];
};

// float32 em base64 (como o build-index grava) → "[0.1,0.2,…]", o formato de texto do pgvector
function toVectorLiteral(base64: string) {
	const vector = new Float32Array(new Uint8Array(Buffer.from(base64, 'base64')).buffer);
	if (vector.length !== DIMENSIONS) throw new Error(`vetor com ${vector.length} dimensões (esperado ${DIMENSIONS})`);
	return `[${vector.join(',')}]`;
}

async function main() {
	if (!existsSync(INDEX)) {
		console.log('index-rag: prisma/data/rag/index.jsonl não existe, nada a carregar.');
		return;
	}
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
	try {
		if (process.argv.includes('--if-empty')) {
			const existing = await prisma.ragChunk.count();
			if (existing > 0) {
				console.log(`index-rag: ${existing} trechos já carregados, nada a fazer.`);
				return;
			}
		}

		const lines = readFileSync(INDEX, 'utf8')
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as IndexLine);
		const rows = lines.flatMap((line) =>
			line.chunks.map((chunk) => ({ documentId: line.id, content: chunk.content, embedding: toVectorLiteral(chunk.embedding) })),
		);

		// Numa transação só: quem pergunta durante a recarga vê o índice antigo, nunca um pela metade
		await prisma.$transaction(
			async (tx) => {
				await tx.ragDocument.deleteMany(); // os trechos vão junto (onDelete: Cascade)
				await tx.ragDocument.createMany({ data: lines.map(({ chunks: _chunks, ...document }) => document) });
				// O Prisma não escreve colunas Unsupported("vector"): INSERT direto, parametrizado
				for (let i = 0; i < rows.length; i += BATCH_SIZE) {
					const values = rows
						.slice(i, i + BATCH_SIZE)
						.map((row) => Prisma.sql`(${row.documentId}, ${row.content}, ${row.embedding}::vector)`);
					await tx.$executeRaw`INSERT INTO "RagChunk" ("documentId", "content", "embedding") VALUES ${Prisma.join(values)}`;
				}
			},
			{ timeout: 120_000 },
		);
		console.log(`index-rag: ${lines.length} documentos e ${rows.length} trechos carregados.`);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((error) => {
	console.error('index-rag: falhou', error);
	process.exitCode = 1;
});
