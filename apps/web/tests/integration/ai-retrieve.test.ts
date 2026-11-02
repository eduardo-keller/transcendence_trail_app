import { MockEmbeddingModelV4 } from 'ai/test';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { MOCK_NOT_FOUND_TRIGGER, mockEmbeddingModel } from '@/server/ai/mock';
import { numberSources, RAG_MIN_SCORE, retrieve, searchChunks } from '@/server/ai/rag/retrieve';
import { createTrail, resetDatabase } from '../helpers/db';
import { addRagDocument, clearRag, vector } from '../helpers/rag';

// A pergunta "vale" o vetor que o teste escolher
let questionVector = vector({ 0: 1 });
vi.mock('@/server/ai/model', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/server/ai/model')>()),
	embeddingModel: () =>
		new MockEmbeddingModelV4({ doEmbed: async () => ({ embeddings: [questionVector], warnings: [] }) }),
}));

beforeEach(async () => {
	await resetDatabase();
	await clearRag();
	questionVector = vector({ 0: 1 });
	// Similaridade com a pergunta (eixo 0): 1, 0,8, 0,6 e 0
	await addRagDocument({ id: 'wiki:Pico do Jaraguá', source: 'WIKIPEDIA', title: 'Pico do Jaraguá', url: 'https://pt.wikipedia.org/wiki/Pico_do_Jaragu%C3%A1', license: 'CC BY-SA 4.0' }, [
		{ content: 'Pico do Jaraguá\n\nO ponto mais alto da cidade de São Paulo.', embedding: vector({ 0: 1 }) },
		{ content: 'Pico do Jaraguá\n\nA Trilha do Pai Zé sobe até o topo.', embedding: vector({ 0: 0.8, 1: 0.6 }) },
	]);
	await addRagDocument({ id: 'trail:TRL-1', source: 'TRAIL', title: 'Trilha do Pai Zé', trailExternalId: 'TRL-1', license: 'ODbL' }, [
		{ content: 'Trilha do Pai Zé\n\nSobe 245 m até o pico.', embedding: vector({ 0: 0.6, 1: 0.8 }) },
	]);
	await addRagDocument({ id: 'guide:o-que-levar', source: 'GUIDE', title: 'O que levar numa trilha' }, [
		{ content: 'O que levar numa trilha\n\nÁgua, lanche e capa de chuva.', embedding: vector({ 1: 1 }) },
	]);
});

afterAll(async () => {
	await clearRag();
	await prisma.$disconnect();
});

describe('searchChunks', () => {
	it('ordena pela similaridade de cosseno (1 − distância do pgvector)', async () => {
		const hits = await searchChunks(vector({ 0: 1 }), 4);
		expect(hits.map((hit) => [hit.documentId, Number(hit.score.toFixed(2))])).toEqual([
			['wiki:Pico do Jaraguá', 1],
			['wiki:Pico do Jaraguá', 0.8],
			['trail:TRL-1', 0.6],
			['guide:o-que-levar', 0],
		]);
		expect((await searchChunks(vector({ 0: 1 }), 2)).length).toBe(2);
	});

	it('liga a descrição à trilha do catálogo pelo externalId (para "Planejar esta trilha")', async () => {
		const trail = await createTrail({ title: 'Trilha do Pai Zé', source: 'OSM', externalId: 'TRL-1' });
		const hits = await searchChunks(vector({ 0: 0.6, 1: 0.8 }), 1);
		expect(hits[0]).toMatchObject({ documentId: 'trail:TRL-1', trailId: trail.id, source: 'TRAIL' });
	});
});

describe('retrieve', () => {
	it(`só os trechos com score ≥ ${RAG_MIN_SCORE}; fontes numeradas por documento`, async () => {
		const { numbered, sources } = await retrieve('Qual o ponto mais alto de São Paulo?');
		// 1 e 0,8 passam; 0,6 (abaixo do limiar) e 0 ficam de fora
		expect(numbered.map((hit) => hit.n)).toEqual([1, 1]);
		expect(sources).toEqual([
			expect.objectContaining({ n: 1, title: 'Pico do Jaraguá', license: 'CC BY-SA 4.0', score: 1 }),
		]);
	});

	it('nada acima do limiar → lista vazia ("não encontrei")', async () => {
		questionVector = vector({ 2: 1 }); // ortogonal a todos os trechos
		const { numbered, sources } = await retrieve('Qual a capital da França?');
		expect(numbered).toEqual([]);
		expect(sources).toEqual([]);
	});

	it('limiar e k ajustáveis', async () => {
		const { sources } = await retrieve('pico', { minScore: 0.5, k: 3 });
		expect(sources.map((source) => [source.n, source.title])).toEqual([
			[1, 'Pico do Jaraguá'],
			[2, 'Trilha do Pai Zé'],
		]);
	});
});

describe('numberSources', () => {
	it('trechos do mesmo documento dividem o número; a ordem segue o melhor trecho', () => {
		const hit = (title: string, score: number) => ({ chunkId: 0, documentId: title, source: 'GUIDE' as const, title, url: null, license: null, trailId: null, content: '', score });
		const { numbered } = numberSources([hit('A', 0.9), hit('B', 0.8), hit('A', 0.7)]);
		expect(numbered.map((h) => `${h.title}${h.n}`)).toEqual(['A1', 'B2', 'A1']);
	});
});

describe('mockEmbeddingModel (LLM_PROVIDER=mock)', () => {
	it('a pergunta pega o vetor do trecho com mais palavras em comum; com [fora], nada parecido', async () => {
		const model = mockEmbeddingModel();
		const { embeddings } = await model.doEmbed({ values: ['O que levar na mochila? Capa de chuva?', `pergunta ${MOCK_NOT_FOUND_TRIGGER}`] });
		const [borrowed, far] = embeddings;
		expect((await searchChunks(borrowed, 1))[0]).toMatchObject({ documentId: 'guide:o-que-levar' });
		expect((await searchChunks(borrowed, 1))[0].score).toBeCloseTo(1);
		expect((await searchChunks(far, 1))[0].score).toBeLessThan(RAG_MIN_SCORE);
	});
});
