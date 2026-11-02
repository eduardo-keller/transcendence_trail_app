import type { UIMessage } from 'ai';
import type { RagSourceRef } from './retrieve';

// Mensagem do chat "Pergunte sobre as trilhas": além do texto, a resposta traz as fontes numeradas
// (parte "data-sources", que chega antes do texto). Só tipos: o navegador também importa este arquivo.
export type AskDataParts = {
	sources: RagSourceRef[];
};

export type AskUIMessage = UIMessage<never, AskDataParts>;
