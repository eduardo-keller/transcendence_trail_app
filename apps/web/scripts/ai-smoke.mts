// Confere a ligação com o Gemini: chave, modelo de texto (streaming e parar no meio) e embeddings.
// Gasta 4 pedidos da cota: 2 de texto, 1 lote de embeddings e 1 embedding simples.
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/ai-smoke.mts
//      ... node scripts/ai-smoke.mts --chave-invalida   mostra o erro que o Google devolve para uma chave errada
//
// Sem dependência de src/ (o node não resolve o alias @/): os nomes dos modelos repetem src/server/ai/model.ts.
import { readFileSync } from 'node:fs';
import { createGoogle } from '@ai-sdk/google';
import { APICallError, cosineSimilarity, embed, embedMany, streamText } from 'ai';

const LLM_MODEL = process.env.LLM_MODEL || 'gemini-3.5-flash-lite';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

let failures = 0;
const ok = (text: string) => console.log(`  \x1b[32m✔\x1b[0m ${text}`);
const nok = (text: string) => {
	console.log(`  \x1b[31m✘\x1b[0m ${text}`);
	failures += 1;
};
const step = (text: string) => console.log(`\n\x1b[1m${text}\x1b[0m`);

function readKey(): string | undefined {
	if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
	try {
		return readFileSync('/run/secrets/gemini_api_key', 'utf8').trim() || undefined;
	} catch {
		return undefined;
	}
}

function describeError(error: unknown): string {
	if (APICallError.isInstance(error)) return `HTTP ${error.statusCode}: ${error.message.slice(0, 160)}`;
	return error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : String(error);
}

const invalidKey = process.argv.includes('--chave-invalida');
const key = invalidKey ? 'chave-invalida-de-teste' : readKey();
if (!key) {
	console.error('Sem chave: cole a chave do Gemini em docker/secrets/gemini_api_key.txt e rode make dev.');
	process.exit(1);
}
const google = createGoogle({ apiKey: key });

if (invalidKey) {
	step(`Chave inválida (${LLM_MODEL})`);
	let error: unknown;
	const result = streamText({
		model: google(LLM_MODEL),
		prompt: 'oi',
		maxRetries: 0,
		onError: (event) => void (error = event.error),
	});
	for await (const _ of result.textStream);
	if (error) ok(`o Google recusou, como esperado → ${describeError(error)}`);
	else nok('o Google aceitou uma chave inválida?');
	process.exit(failures ? 1 : 0);
}

step(`1. Texto em streaming (${LLM_MODEL})`);
{
	const started = Date.now();
	let firstAt = 0;
	let pieces = 0;
	let text = '';
	let error: unknown;
	const result = streamText({
		model: google(LLM_MODEL),
		prompt: 'Em uma frase curta, em português: o que levar numa trilha de 2 km?',
		maxRetries: 0,
		onError: (event) => void (error = event.error),
	});
	for await (const piece of result.textStream) {
		if (!firstAt) firstAt = Date.now() - started;
		pieces += 1;
		text += piece;
	}
	if (error) nok(describeError(error));
	else {
		ok(`${pieces} pedaços; o primeiro em ${firstAt} ms; total ${Date.now() - started} ms`);
		console.log(`    "${text.trim()}"`);
	}
}

step('2. Parar no meio (abortSignal)');
{
	const controller = new AbortController();
	let pieces = 0;
	let aborted = false;
	let error: unknown;
	const result = streamText({
		model: google(LLM_MODEL),
		prompt: 'Escreva os números de 1 a 300 por extenso, um por linha.',
		maxRetries: 0,
		abortSignal: controller.signal,
		onAbort: () => {
			aborted = true;
		},
		onError: (event) => void (error = event.error),
	});
	try {
		for await (const _ of result.textStream) {
			pieces += 1;
			if (pieces === 3) controller.abort();
		}
	} catch (caught) {
		if (!(caught instanceof Error && caught.name === 'AbortError')) error = caught;
	}
	if (error) nok(describeError(error));
	else if (aborted && pieces < 20) ok(`parou depois de ${pieces} pedaços`);
	else nok(`não parou (pedaços: ${pieces}, onAbort: ${aborted})`);
}

step(`3. Embeddings (${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS} dimensões)`);
try {
	const documents = [
		'Trilha da Pedra Grande, em Atibaia: subida de 2,5 km até um mirante de rocha com vista da cidade.',
		'Trilha da Cachoeira do Funil: percurso longo na mata, com travessia de riacho e poço para banho.',
		'Receita de bolo de cenoura com cobertura de chocolate.',
	];
	const { embeddings } = await embedMany({
		model: google.embedding(EMBEDDING_MODEL),
		values: documents,
		maxRetries: 0,
		providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' } },
	});
	const question = 'Onde tem uma trilha com mirante perto de Atibaia?';
	const { embedding } = await embed({
		model: google.embedding(EMBEDDING_MODEL),
		value: question,
		maxRetries: 0,
		providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' } },
	});

	const sizes = new Set([...embeddings, embedding].map((vector) => vector.length));
	if (sizes.size === 1 && sizes.has(EMBEDDING_DIMENSIONS)) ok(`${embeddings.length + 1} vetores de ${EMBEDDING_DIMENSIONS} dimensões`);
	else nok(`dimensões inesperadas: ${[...sizes].join(', ')}`);

	const scores = embeddings.map((vector) => cosineSimilarity(embedding, vector));
	console.log(`    pergunta: "${question}"`);
	documents.forEach((document, i) => console.log(`    ${scores[i].toFixed(3)}  ${document.slice(0, 60)}…`));
	const best = scores.indexOf(Math.max(...scores));
	const worst = scores.indexOf(Math.min(...scores));
	if (best === 0 && worst === 2) ok('a trilha certa ficou em 1º e o bolo em último');
	else nok('a ordem da similaridade não é a esperada');
} catch (error) {
	nok(describeError(error));
}

console.log(failures ? `\n${failures} falha(s).` : '\nTudo certo.');
process.exit(failures ? 1 : 0);
