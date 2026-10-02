# ADR-0007: Provedor de LLM e embeddings

- **Status:** **Pendente**: decidir no kickoff (depende de orçamento e das contas que o time tiver)
- **Data:** 2026-10-01
- **Decisores:** time; F5 conduz
- **Frentes afetadas:** F5 (implementa), F1 (segredos, métricas)

## Contexto

- Dois módulos Major dependem de LLM: **Interface de LLM** (geração com streaming, erros, rate limit) e **RAG**.
- O RAG precisa de **embeddings** (vetores que representam o significado do texto) para indexar o corpus e as perguntas.
- Restrições: orçamento de estudante; a chave precisa funcionar **no dia da avaliação**; desenvolvimento e CI não devem gastar dinheiro.

## Decisão proposta (parte fechada)

1. **Interface própria de provedor** no serviço `ai` (`LlmProvider` com `streamText()`), implementada com o **SDK oficial** do provedor escolhido. Trocar de provedor fica restrito a um arquivo.
2. **Provedor `mock`** (`LLM_PROVIDER=mock`): devolve texto fixo em streaming, com atraso simulado. É usado em dev, testes e CI. Custo zero, sem chave.
3. **Embeddings locais**: modelo multilíngue pequeno (suporta português) rodando no próprio serviço `ai`, via biblioteca de inferência em Node (ex.: `@huggingface/transformers` com um modelo da família *multilingual-e5-small*, 384 dimensões). Sem custo, sem limite, funciona offline e deixa a ingestão reprodutível. Detalhe operacional: o modelo é baixado no build da imagem para não depender da internet no start.
4. Rate limit e teto diário de gasto no próprio `ai` (Redis), mais métricas de tokens no Grafana.

## Decisão pendente: provedor de geração

Opções (verificar preços e camadas gratuitas na data da decisão):

| Opção | Prós | Contras |
|---|---|---|
| **Anthropic (Claude)**, SDK `@anthropic-ai/sdk` | Ótima qualidade em português; streaming simples no SDK oficial | Sem camada gratuita; a API não tem endpoint de embeddings (por isso os embeddings locais) |
| OpenAI | Ecossistema grande; também oferece embeddings | Sem camada gratuita relevante |
| Google Gemini | Tem camada gratuita (com limites) | Limites e termos da camada gratuita mudam; dados da camada gratuita podem ser usados pelo provedor |
| Modelo local (Ollama) | Grátis, offline | Pesado para as máquinas (RAM/CPU), lento e de qualidade menor; mais um container grande |

**Se a escolha for Claude:** o modelo padrão recomendado é `claude-opus-5-5` (US$ 4 / US$ 20 por milhão de tokens de entrada/saída). Alternativas mais baratas, **se o time decidir priorizar custo**: `claude-sonnet-5-5` (US$ 2 / US$ 10) e `claude-haiku-4-5` (US$ 1 / US$ 5). Preços de referência de 2026-09-25: confirme antes de decidir.

Estimativa grosseira por requisição (RAG: ~3.000 tokens de entrada e ~600 de saída; planejador: ~800 de entrada e ~1.200 de saída):

| Modelo | RAG | Planejador | 2.000 requisições (projeto todo) |
|---|---|---|---|
| `claude-opus-5-5` | ~US$ 0,024 | ~US$ 0,027 | ~US$ 50 |
| `claude-sonnet-5-5` | ~US$ 0,012 | ~US$ 0,014 | ~US$ 25 |
| `claude-haiku-4-5` | ~US$ 0,006 | ~US$ 0,007 | ~US$ 13 |

Com `mock` em dev e CI, o gasto real fica concentrado em testes manuais, demos e avaliação.

**Para decidir no kickoff:** quem tem conta ou crédito em qual provedor; orçamento máximo; modelo principal; se vale usar um modelo mais barato em dev e o principal na demo.

## Consequências

**Positivas:** trocar de provedor é barato; o desenvolvimento não gasta; o RAG não depende de API externa para embeddings.

**Negativas:** a imagem do `ai` fica maior (modelo de embeddings embutido); a qualidade dos embeddings locais é boa, mas não é a melhor do mercado (suficiente para o volume do projeto).

**Riscos:** chave sem saldo ou cota esgotada na avaliação → saldo reservado, alerta de gasto, chave reserva de outro membro; o rate limit do provedor aparece como erro amigável (isso faz parte do módulo).

## 💡 Para aprender

- Tokens, janela de contexto e custo por token.
- Streaming com SSE e cancelamento (AbortController).
- Embeddings e similaridade de cosseno; por que o modelo de embeddings da indexação e da consulta precisa ser o **mesmo**.
- Prompt injection: texto recuperado é **dado**, não instrução.
