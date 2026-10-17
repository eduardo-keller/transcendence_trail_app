# Provedor de LLM e embeddings

> Última atualização: 2026-10-17 — a IA agora roda dentro do Next.js (não há serviço `ai`). Dono: Edu.
> Status: **pendente** (provedor de geração).

## Contexto

- Dois módulos Major dependem disso: **Interface de LLM** (streaming, erros, rate limit) e **RAG**.
- O RAG precisa de embeddings para indexar o corpus e as perguntas.
- Orçamento de estudante. A chave precisa funcionar **no dia da avaliação**. Desenvolvimento não deve gastar dinheiro.

## Proposta (parte fechada)

1. **Uma interface própria de provedor** (ex.: `streamText()`), implementada com o SDK oficial do provedor escolhido. Trocar de provedor fica restrito a um arquivo.
2. **Provedor `mock`** (`LLM_PROVIDER=mock`): devolve texto fixo em streaming, com atraso simulado. Usado em dev e nos testes; custo zero, sem chave.
3. **Embeddings locais:** modelo multilíngue pequeno (suporta português, ~384 dimensões) rodando no próprio Node. Sem custo, funciona offline. O modelo é baixado no build da imagem, não no start.
4. **Vetores no banco principal** (pgvector já instalado), consultados com `$queryRaw`.
5. **Rate limit por usuário** e um teto diário de chamadas, no próprio app.

## Pendente: provedor de geração

Confira preços e camadas gratuitas **na data da decisão**; eles mudam com frequência.

| Opção | Prós | Contras |
|---|---|---|
| Anthropic (Claude) | Boa qualidade em português; streaming simples no SDK oficial | Sem camada gratuita; sem endpoint de embeddings (por isso os embeddings locais) |
| OpenAI | Ecossistema grande; também tem embeddings | Sem camada gratuita relevante |
| Google Gemini | Camada gratuita, com limites | Limites e termos da camada gratuita mudam; os dados podem ser usados pelo provedor |
| Modelo local (Ollama) | Grátis, offline | Pesado para as máquinas da 42; lento; qualidade menor |

**Para decidir:** quem do time tem conta ou crédito em qual provedor; orçamento máximo; se vale um modelo mais barato em dev e o principal na demo; chave reserva para a avaliação.
