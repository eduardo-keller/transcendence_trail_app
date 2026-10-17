# Plano: Interface de LLM e RAG

- **Área / módulo(s):** Edu / 7. Interface de LLM e 8. Sistema RAG ([MODULOS.md](../../MODULOS.md#edu--ia-e-complementos))
- **Status:** Rascunho
- **Última atualização:** 2026-10-17

A gamificação (módulo 11) fica num plano separado: depende do catálogo e do `notify()`, que ainda não existem.

## 1. Objetivo

Duas telas e dois endpoints separados (são dois módulos), ambos com streaming, botão de parar, rate limit e erro amigável:
- **Planejador** (7): trilha + data + experiência do grupo + tempo disponível → plano gerado em streaming.
- **Pergunte sobre as trilhas** (8): busca no pgvector num corpus de 2.000+ trechos → resposta com fontes numeradas, ou "não encontrei".

Tudo funciona com `LLM_PROVIDER=mock` (sem chave, custo zero). O provedor real é escolhido por variável.

## 2. Estado atual verificado

| O quê | Situação | Onde |
|---|---|---|
| Código de IA | Nenhum; nenhuma dependência de LLM | `apps/web/package.json` |
| pgvector | Extensão criada no init do banco; nenhuma tabela usa | `docker/postgres/tools/entrypoint.sh` |
| Trilhas | 3.878 em `Trail`; ~90 utilizáveis depois de um filtro que ainda não existe | [dados-trilhas.md](../../dados-trilhas.md) |
| Sessão | `auth.api.getSession()` existe; `requireUser()` ainda não | `src/lib/auth.ts` |
| Helpers de API | `withHandler`, `ApiError`, `parseBody` | `src/server/api/` |
| Imagem `nextjs` | `alpine:3.24.2` (musl), Node 24 | `docker/nextjs/Dockerfile` |
| Versões no npm em 2026-10-17 | `ai` 7.0.143 · `@ai-sdk/react` 4.0.147 · `@ai-sdk/anthropic` 4.0.82 · `@ai-sdk/google` 4.0.99 · `langchain` 1.5.18 · `@huggingface/transformers` 4.3.1 | registry.npmjs.org |

**Divergência com [llm.md](../../decisoes/llm.md)** ("embeddings locais rodando no próprio Node"). Teste feito em 2026-10-17 com `Xenova/multilingual-e5-small` (q8, 384 dimensões):

| Imagem | Resultado |
|---|---|
| `alpine:3.24.2` (a do projeto) | **Falha.** `ERR_DLOPEN_FAILED` no import: o binário do `onnxruntime-node` é para glibc. Pedir `device: 'wasm'` não adianta (o import já carrega o binário). Forçar o build "web" no Node falha ao carregar o modelo |
| `node:24-slim` (Debian) | **Funciona.** 16 ms para 3 textos; primeira carga em 7 s, com o download |

- Custo: +744 MB no `node_modules` (548 MB do `onnxruntime-node`, que traz binários de todas as plataformas).
- Os scores do e5 são comprimidos: pergunta × trecho certo 0,842; pergunta × trecho errado 0,800. O limiar de "não encontrei" precisa ser **calibrado com perguntas de teste**.

## 3. Decisões que destravam o plano

| # | Decisão | Recomendação | Quem |
|---|---|---|---|
| D1 | Biblioteca para falar com o LLM | **Vercel AI SDK 7** para o transporte; **pipeline do RAG escrito à mão**, sem LangChain (seção 4) | Edu |
| D2 | Onde rodam os embeddings | **(a)** imagem `nextjs` em Debian slim + embeddings locais. **(b)** Se o Gabs recusar: embeddings por API (Gemini ou OpenAI) com o `embed()` do mesmo AI SDK; perde o "funciona offline" | Edu + Gabs ("imagens Alpine" é decisão dele) |
| D3 | Provedor de geração e orçamento | Decidir no passo 6: com o AI SDK, trocar é mudar uma variável. Dev: `mock` (e camada gratuita, se houver). Demo: o melhor modelo com crédito disponível. Chave reserva de **outro** provedor | Edu + time, se houver custo |
| D4 | Guardar o texto das perguntas? | Não. Só o contador do rate limit. Menos dado pessoal para o GDPR | Edu + Di |

## 4. SDK do provedor × biblioteca multi-provedor

| | SDK oficial + interface própria | **Vercel AI SDK 7** | LangChain.js 1.x |
|---|---|---|---|
| Trocar de provedor | Reescrever o adaptador | Trocar o import (por variável) | Trocar o pacote `@langchain/<provedor>` |
| Streaming até o navegador | Escrever tudo: `ReadableStream`, protocolo, leitura no cliente, `AbortController` | Pronto: `streamText` + `useChat`/`useCompletion` com `stop()`, `status`, `error` | Precisa de adaptador para o React |
| Mock em dev | Escrever | Pronto: `MockLanguageModelV4` + `simulateReadableStream` | `FakeListChatModel` |
| pgvector | Escrever a busca | Escrever a busca (`embed`/`embedMany` só se D2b) | `PGVectorStore` cria tabelas próprias, **fora do Prisma e das migrations** |
| Dependências | 1 | 3: `ai`, `@ai-sdk/react`, uma por provedor | `langchain` puxa `@langchain/core`, `langgraph`, `langsmith`, mais uma por provedor |
| Abstração | Nenhuma | Fina: prompt, busca e contexto continuam meus | Grossa: chains, retrievers, agentes, middleware |
| Mudança de API | Rara | Frequente: v5 → v6 → v7 em ~12 meses. Fixar a versão | Frequente (0.1 → 0.3 → 1.x) |
| Explicar ao vivo | Fácil, com mais código meu | Fácil: a lib só faz o transporte | Difícil: a recuperação fica dentro da lib |

Por que AI SDK + RAG à mão:
- A "interface própria de provedor" do llm.md é o que o AI SDK já entrega: um formato único de modelo, vários provedores, mock. Escrever isso não vale ponto.
- O que o avaliador pergunta (embedding, recuperação, prompt, limiar, rate limit) fica em código meu, curto, fácil de mudar ao vivo.
- LangChain resolve o que o projeto não tem (agentes, dezenas de integrações) e cria o que tem: tabelas fora do Prisma e recuperação escondida.
- Usar `anthropic('…')`, `google('…')` dos pacotes `@ai-sdk/*`. **Não** passar o modelo como string (`"anthropic/…"`): isso vai pelo AI Gateway da Vercel, que exige outra conta.

## 5. Critérios de aceite

As caixas dos módulos 7 e 8 em [MODULOS.md](../../MODULOS.md#edu--ia-e-complementos), mais:

- [ ] Parar cancela também a chamada ao provedor (`abortSignal: request.signal`)
- [ ] Rate limit por usuário: por minuto e teto diário; a tela mostra quanto falta para liberar
- [ ] Provedor fora do ar (chave inválida, timeout) → mensagem amigável, página intacta
- [ ] "Não encontrei" sem chamar o LLM quando o melhor trecho fica abaixo do limiar
- [ ] Fontes com título e link; Wikipedia com a licença (CC BY-SA)
- [ ] Avaliação da busca: 20 perguntas de teste, documento certo entre os 5 primeiros em ≥ 80%
- [ ] Rota sem login → 401; entrada inválida → 400 (zod no front e no back)
- [ ] Sem erros ou warnings no console, **inclusive** ao parar, no limite e no erro do provedor
- [ ] Nada a acrescentar na lista de notificações: o plano gerado não é salvo, e perguntar não cria dado do usuário

## 6. Desenho

**Arquivos** (`apps/web/`):

```
src/server/ai/
  model.ts          getModel(): lê LLM_PROVIDER e LLM_MODEL. Único arquivo que conhece provedores
  mock.ts           modelo falso com streaming e atraso
  rate-limit.ts     consumeAiQuota(userId)
  errors.ts         erro do provedor → mensagem amigável
  planner/prompt.ts
  rag/embed.ts      carrega o modelo uma vez (cache em globalThis, como o prisma)
  rag/chunk.ts      texto → trechos
  rag/retrieve.ts   busca no pgvector com $queryRaw
  rag/prompt.ts     contexto numerado + regras
src/app/(assistente)/planejar/page.tsx
src/app/(assistente)/perguntar/page.tsx
src/app/api/ai/plan/route.ts    POST, streaming
src/app/api/ai/ask/route.ts     POST, streaming
src/app/api/ai/quota/route.ts   GET
prisma/rag-sources.mts          baixa Wikipedia e POIs para prisma/data/rag/ (manual; nunca em tempo de execução)
prisma/index-rag.mts            trechos + embeddings no banco; --if-empty no start, como o import-trails
scripts/eval-rag.mts            acerto da busca com as perguntas de teste
```

**Dados** (uma migration; o Gabs revisa):

```prisma
enum RagSource { TRAIL WIKIPEDIA OSM_POI GUIDE }

model RagDocument {
  id          String     @id @default(cuid())
  source      RagSource
  externalId  String     // id da trilha, título do artigo, id do nó no OSM, nome do guia
  title       String
  url         String?
  license     String?    // "CC BY-SA 4.0", "ODbL"
  contentHash String     // reindexar só o que mudou
  trailId     String?
  trail       Trail?     @relation(fields: [trailId], references: [id], onDelete: SetNull)
  chunks      RagChunk[]

  @@unique([source, externalId])
}

model RagChunk {
  id         String      @id @default(cuid())
  documentId String
  document   RagDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  index      Int
  content    String
  embedding  Unsupported("vector(384)")?

  @@unique([documentId, index])
}

// Rate limit do assistente: um contador por usuário e janela ("2026-10-17T13:05" = minuto, "2026-10-17" = dia)
model AiUsage {
  userId String
  window String
  count  Int    @default(0)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, window])
}
```

- Índice HNSW (`vector_cosine_ops`) escrito à mão no SQL da migration (`--create-only`, editar, aplicar): o Prisma não expressa esse índice.
- Rate limit: `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count` para o minuto e para o dia. Atômico: duas abas juntas não furam o limite (regra do TECNICO: nunca "verifica e depois insere"). No banco, e não em memória, porque o teto diário protege o orçamento e não pode zerar quando o container reinicia. Limites em `AI_LIMIT_PER_MINUTE` e `AI_LIMIT_PER_DAY`.

**API**

| Rota | Entrada | Saída | Erros antes do stream |
|---|---|---|---|
| `POST /api/ai/plan` | `{ trailId, date, experience: BEGINNER\|INTERMEDIATE\|EXPERIENCED, hoursAvailable: 1–12 }` | texto em streaming | 400, 401, 404 `TRAIL_NOT_FOUND`, 429 `AI_RATE_LIMITED` com `retryAfter` |
| `POST /api/ai/ask` | `{ question: 3–500 caracteres }` | fontes primeiro, depois o texto | 400, 401, 429 |
| `GET /api/ai/quota` | — | `{ remainingMinute, remainingDay, resetsAt }` | 401 |

- O planejador busca a trilha no banco; não confia em dados vindos do cliente.
- Erro **durante** o stream (provedor caiu) chega como parte de erro dentro do próprio stream, com mensagem genérica.
- Resposta com o cabeçalho `X-Accel-Buffering: no`, para o nginx não segurar o stream.

**Console limpo × 429.** O Chrome mostra no console toda resposta 4xx/5xx de `fetch` ([TECNICO.md](../../TECNICO.md#console-limpo)). Então a tela consulta `/api/ai/quota` e desabilita o botão, com contagem regressiva, antes de chegar ao 429. O servidor continua devolvendo 429 (demonstrável por `curl`).

**UI** (componentes da Juh: Button, Textarea, Select, Card, Toast, Skeleton)
- Planejador: trilha (só ≥ 500 m, busca por nome), data, experiência, horas → Gerar; texto em streaming; Parar; Tentar de novo; aviso "a IA pode errar e não considera a previsão do tempo".
- Perguntas: campo com exemplos; resposta com [1], [2] ligados à lista de fontes; rodapé "Base: N trechos de M documentos".
- Markdown da IA sem `dangerouslySetInnerHTML` (texto puro ou uma lib que não injeta HTML).

**Corpus** (meta: 2.000+ trechos)

| Fonte | Como | Estimativa |
|---|---|---|
| Trilhas | Uma ficha de texto por trilha, gerada do `Trail`; só as que passam no filtro | 90–200 |
| Wikipedia (pt) | Parques, picos, serras e cidades da região, pela API do MediaWiki, salvos em `prisma/data/rag/` | 60–100 artigos → 1.500+ trechos |
| POIs do OSM | Picos, cachoeiras, mirantes, áreas protegidas ([consultas-osm.md](../consultas-osm.md)); um trecho por item | 300–600 |
| Guias do time | Segurança, equipamento, o que levar; markdown nosso | 30–60 |

Trechos de ~600 caracteres com ~100 de sobreposição, cortando em parágrafo. O e5 exige prefixo: `passage: ` no corpus, `query: ` na pergunta. O RAG começa pela Wikipedia, pelos POIs e pelos guias: não espera o catálogo.

## 7. Impacto em outras pessoas

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Gabs | D2 (Debian slim?); migration nova; secret `llm_api_key` no compose e no entrypoint; modelo baixado no build, fora de `/app` (o código é montado por cima); alvo `make index-rag`; nginx sem buffer em `/api/ai/` | [ ] |
| Di | Uso `auth.api.getSession()` até o `requireUser()` sair. `AiUsage` é dado pessoal: o cascade já cobre a exclusão; decidir se entra na exportação | [ ] |
| Juh | Componentes listados na UI | [ ] |
| Catálogo (sem dono) | Planejador lista trilhas do `Trail`; o indexador filtra (≥ 500 m e nome) até a importação filtrar | [ ] |
| Privacidade e Termos | Perguntas vão para o provedor escolhido; IA pode errar; Wikipedia CC BY-SA | [ ] |

Nenhuma interface nova para outras pessoas em [TECNICO.md](../../TECNICO.md#interfaces-entre-pessoas).

## 8. Passos

**(eu)** = parte central que escrevo sem agente.

Fase 0: decisões
- [ ] 1. Fechar D1–D4; D2 com o Gabs. Registrar em llm.md e em decisoes/README.md.
- [ ] 2. Aprovar dependências: `ai`, `@ai-sdk/react`, `@ai-sdk/<provedor>`; `@huggingface/transformers` (se D2a).

Fase 1: módulo 7 com mock (não depende de ninguém)
- [ ] 3. `model.ts` + `mock.ts`; `POST /api/ai/plan` em streaming com o mock **(eu: route handler e prompt)**.
- [ ] 4. Tela do planejador com Parar e Tentar de novo; console limpo.
- [ ] 5. `AiUsage` + `consumeAiQuota` + `/api/ai/quota` + aviso na tela **(eu: rate limit)**.
- [ ] 6. Provedor real atrás da variável; chave inválida e timeout viram mensagem amigável. Fechar D3.

Fase 2: corpus e busca
- [ ] 7. Embeddings no container do projeto (depois de D2); medir o tempo de indexação.
- [ ] 8. `rag-sources.mts`; escrever os guias.
- [ ] 9. Migration `RagDocument`/`RagChunk` + HNSW; `index-rag.mts` idempotente.
- [ ] 10. `retrieve.ts` **(eu)** + `eval-rag.mts`; calibrar limiar e top-k.

Fase 3: módulo 8
- [ ] 11. `POST /api/ai/ask`: busca → limiar → prompt → stream com fontes **(eu: prompt e limiar)**.
- [ ] 12. Tela de perguntas com fontes e tamanho do corpus.

Fase 4: fechar
- [ ] 13. Verificação (seção 9).
- [ ] 14. Docs: caixas em MODULOS.md; llm.md; README (Technical Stack, Modules, Features, Database Schema, Resources); `docker/.env.example` (`LLM_PROVIDER`, `LLM_MODEL`, `AI_LIMIT_PER_MINUTE`, `AI_LIMIT_PER_DAY`).

## 9. Como verificar

```bash
BASE=http://localhost:3000   # https://localhost quando o nginx existir
curl -s -X POST $BASE/api/ai/ask -H 'content-type: application/json' -d '{"question":"oi"}'   # 401
# com o cookie de sessão (-b):
curl -s  -b c.txt -X POST $BASE/api/ai/ask -H 'content-type: application/json' -d '{"question":""}'   # 400 VALIDATION_ERROR
curl -sN -b c.txt -X POST $BASE/api/ai/ask -H 'content-type: application/json' -d '{"question":"Onde fica o Pico do Jaraguá?"}'   # chega aos poucos
# repetir além de AI_LIMIT_PER_MINUTE → 429 com retryAfter
make sh   # e dentro: node scripts/eval-rag.mts → acerto@5
```

No Chrome, com o DevTools aberto: gerar um plano; parar no meio; estourar o limite pela tela (botão desabilita, nenhum 429 no console); chave inválida → mensagem amigável; pergunta fora do corpus ("receita de bolo") → "não encontrei"; Network → Slow 4G para ver o streaming.

## 10. Para eu explicar na avaliação

- A diferença entre os módulos: o 7 é a interface (streaming, parar, erros, limite); o 8 é recuperar contexto de uma base própria e gerar a partir dele.
- Embedding; distância de cosseno; o que o HNSW faz (busca aproximada) e o que perde.
- Tamanho e sobreposição dos trechos; prefixos do e5.
- Como o limiar foi escolhido (eval), e por que "não encontrei" não chama o LLM.
- Como o stream chega ao navegador; o que acontece no servidor ao apertar Parar.
- Rate limit: janela fixa, contador atômico no banco, por que não fica em memória.
- O que o AI SDK faz e o que eu escrevi; por que não LangChain.
- Modificações ao vivo prováveis: mudar o limite, o top-k ou o limiar; acrescentar um guia e reindexar; mudar o prompt do planejador.

## 11. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-17 | Rascunho. Teste: `@huggingface/transformers` não roda em `alpine:3.24.2`; roda em `node:24-slim` |
