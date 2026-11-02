import type { UIMessage } from 'ai';
import type { RagSourceRef } from './retrieve';

// Mensagem do chat "Pergunte sobre as trilhas": além do texto, a resposta traz as fontes numeradas
// (parte "data-sources", que chega antes do texto) e, a partir da segunda pergunta, a memória da conversa
// (parte "data-memory": o resumo, que o navegador manda de volta no próximo pedido, e a pergunta usada
// na busca). Só tipos: o navegador também importa este arquivo.
export type AskDataParts = {
	sources: RagSourceRef[];
	memory: { summary: string; question: string; rewritten: boolean };
};

export type AskUIMessage = UIMessage<never, AskDataParts>;
