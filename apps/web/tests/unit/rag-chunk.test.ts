import { describe, expect, it } from 'vitest';
import {
	CHUNK_OVERLAP,
	CHUNK_SIZE,
	chunkText,
	decodeVector,
	encodeVector,
	loadCorpus,
} from '../../scripts/rag/build-index.mjs';

const sentence = (i: number) => `Esta é a frase número ${i} do texto de teste, sobre uma trilha qualquer.`;
const paragraph = (from: number, count: number) => Array.from({ length: count }, (_, i) => sentence(from + i)).join(' ');

describe('chunkText', () => {
	it('texto curto vira um trecho só, com o título no começo', () => {
		expect(chunkText('Pico do Jaraguá', 'O ponto mais alto de São Paulo.')).toEqual([
			'Pico do Jaraguá\n\nO ponto mais alto de São Paulo.',
		]);
	});

	it('texto longo: trechos de até 800 caracteres, todos com o título, sem perder nenhuma frase', () => {
		const text = Array.from({ length: 12 }, (_, p) => paragraph(p * 5, 5)).join('\n');
		const chunks = chunkText('Artigo', text);
		expect(chunks.length).toBeGreaterThan(3);
		for (const chunk of chunks) {
			expect(chunk.startsWith('Artigo\n\n')).toBe(true);
			expect(chunk.length - 'Artigo\n\n'.length).toBeLessThanOrEqual(CHUNK_SIZE);
		}
		for (let i = 0; i < 60; i += 1) expect(chunks.some((chunk) => chunk.includes(sentence(i)))).toBe(true);
	});

	it('o trecho seguinte repete o fim do anterior (sobreposição), começando numa frase', () => {
		const text = Array.from({ length: 12 }, (_, p) => paragraph(p * 5, 5)).join('\n');
		const chunks = chunkText('Artigo', text).map((chunk) => chunk.slice('Artigo\n\n'.length));
		for (let i = 1; i < chunks.length; i += 1) {
			const firstLine = chunks[i].split('\n')[0];
			expect(chunks[i - 1].endsWith(firstLine)).toBe(true);
			expect(firstLine.length).toBeLessThanOrEqual(CHUNK_OVERLAP);
			expect(firstLine).toMatch(/^Esta é a frase/);
		}
	});

	it('o título de uma seção fica junto do parágrafo que vem depois dele', () => {
		const text = `${paragraph(0, 9)}\nFauna e flora\n${paragraph(100, 9)}`;
		const chunks = chunkText('Artigo', text);
		const withHeading = chunks.find((chunk) => chunk.includes('Fauna e flora'));
		expect(withHeading).toContain(`Fauna e flora\n${sentence(100)}`);
	});
});

describe('encodeVector / decodeVector', () => {
	it('ida e volta em float32', () => {
		const vector = [0.5, -0.25, 0.125, 0];
		expect(decodeVector(encodeVector(vector))).toEqual(vector);
	});
});

describe('corpus versionado (prisma/data/rag)', () => {
	it('tem ~2.000 trechos das três fontes, com ids únicos', () => {
		const documents = loadCorpus();
		const chunks = documents.flatMap((document) => chunkText(document.title, document.text));
		expect(chunks.length).toBeGreaterThanOrEqual(2000);
		expect(new Set(documents.map((document) => document.id)).size).toBe(documents.length);
		const count = (source: string) => documents.filter((document) => document.source === source).length;
		expect(count('WIKIPEDIA')).toBeGreaterThanOrEqual(80);
		expect(count('TRAIL')).toBeGreaterThanOrEqual(80);
		expect(count('GUIDE')).toBeGreaterThanOrEqual(20);
		// Licença e link em toda fonte da Wikipedia (CC BY-SA exige a atribuição)
		for (const document of documents.filter((d) => d.source === 'WIKIPEDIA')) {
			expect(document.url).toMatch(/^https:\/\/pt\.wikipedia\.org\//);
			expect(document.license).toBe('CC BY-SA 4.0');
		}
	});
});
