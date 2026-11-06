import { createGoogle } from '@ai-sdk/google';
import type { EmbeddingModel, LanguageModel } from 'ai';
import { readSecret } from '@/lib/secrets';
import { AiNotConfiguredError } from './errors';
import { mockEmbeddingModel, mockLanguageModel } from './mock';

// Único arquivo que sabe qual provedor está em uso: o resto do código pede um modelo
// e não sabe se é o Gemini ou o mock. Trocar de provedor = mudar este arquivo.

export const DEFAULT_LLM_MODEL = 'gemini-3.5-flash-lite';

// O corpus do RAG é indexado com este modelo e esta dimensão; a pergunta precisa usar os mesmos.
// A dimensão tem que bater com vector(768) no schema.prisma.
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

export const isMockProvider = () => process.env.LLM_PROVIDER === 'mock';

// Lida a cada chamada: trocar o arquivo do secret vale na hora, sem reiniciar o app.
// Sem chave, o erro acontece dentro do stream e vira mensagem amigável (errors.ts).
function apiKey(): string {
	const key = readSecret('gemini_api_key');
	if (!key) throw new AiNotConfiguredError();
	return key;
}

const google = createGoogle({ apiKey });

// Para a tela avisar e desabilitar o botão antes de alguém tentar
export function isAiConfigured(): boolean {
	return isMockProvider() || Boolean(readSecret('gemini_api_key'));
}

export function languageModel(): LanguageModel {
	if (isMockProvider()) return mockLanguageModel();
	return google(process.env.LLM_MODEL || DEFAULT_LLM_MODEL);
}

export function embeddingModel(): EmbeddingModel {
	if (isMockProvider()) return mockEmbeddingModel();
	return google.embedding(EMBEDDING_MODEL);
}
