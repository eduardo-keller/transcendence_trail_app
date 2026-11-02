# Plano: Interface de LLM (7) e RAG (8) com o Gemini

- **Área / módulo(s):** Edu / 7. Interface de LLM e 8. Sistema RAG ([MODULOS.md](../../MODULOS.md#edu--ia-e-complementos))
- **Status:** Em execução (etapas 1–4 implementadas, em revisão; módulo 7 completo)
- **Última atualização:** 2026-11-02

Substitui o rascunho de 2026-10-17, que previa embeddings locais (exigia trocar a imagem Alpine do Gabs por Debian, +744 MB). Com o Gemini, os embeddings vêm da mesma API: nada muda na imagem. A gamificação (módulo 11) fica num plano separado.

## 1. Objetivo

Duas telas e dois endpoints separados (são dois módulos), ambos com streaming, botão de parar, rate limit e erro amigável:
- **Planejador** (`/planejar`, módulo 7): trilha + data + experiência do grupo + horas disponíveis + observações → plano gerado em streaming.
- **Pergunte sobre as trilhas** (`/perguntar`, módulo 8): um chat. Cada pergunta busca no pgvector num corpus de ~2.000 trechos → resposta com fontes numeradas, ou "não encontrei". O chat lembra a conversa atual (resumo + últimas trocas), e só ela.

As duas são páginas comuns, acessadas pelo menu (sem widget flutuante).

Tudo funciona com `LLM_PROVIDER=mock` (sem chave, sem gastar cota). O Gemini entra por variável.

## 2. Estado atual verificado

| O quê | Situação (2026-11-02) | Onde |
|---|---|---|
| Código e dependências de IA | Nenhum | `apps/web/package.json` |
| pgvector | 0.8.1 no banco principal (criado pelo init). **Não existe no banco `_test`**: o `global-setup` cria o banco sem a extensão → a migration precisa de `CREATE EXTENSION IF NOT EXISTS vector` | `docker/postgres/tools/entrypoint.sh`, `tests/setup/global-setup.ts` |
| Trilhas | 3.878 do OSM no banco. Reais: **~90** (≥ 500 m e nome com Trilha/Caminho/Pico/Cachoeira/Pedra: 88). Só 13 têm descrição e 6 têm link para a Wikipedia | [dados-trilhas.md](../../dados-trilhas.md) |
| Sessão | `requireUser()` (401) e `requirePageUser()` (redireciona) prontos; usuários de teste `alice`…`eva` | `src/server/auth/session.ts` (Di) |
| Trilha por id | `getTrail(id, viewerId)` respeita a visibilidade | `src/server/trails/service.ts` (Gabs) |
| Helpers | `withHandler`, `parseBody`, `ApiError`; `readSecret(nome)` lê `/run/secrets/<nome>` ou a variável | `src/server/api/`, `src/lib/secrets.ts` |
| nginx | `proxy_buffering off` e `proxy_read_timeout 1h` em `/`: **o streaming já passa sem mudança** | `docker/nginx/conf/nginx.conf.template` |
| Design system e layout | Só os tokens de cor e fonte em `globals.css` (`paper`, `sand`, `moss`, `forest`, `clay`, `ink`…). Sem `components/ui/` nem cabeçalho/rodapé; a `NavBar` (rascunho do Rafa) só aparece em `/` | `src/app/globals.css`, `src/components/navbar.tsx` |
| `notify()` | Não existe. **Não é necessário aqui**: gerar um plano ou perguntar não cria, edita nem exclui dado do usuário | — |
| Testes | Vitest (unit + integração no banco `_test`, `signInAs()` para simular a sessão), bash + curl pelo nginx, Python + Chrome sem janela que **captura o console** | `apps/web/tests/`, `tests/`, `tests/ui/browser.py` |
| Container | Alpine, Node 24.22; o app está no ar em modo dev | `docker/nextjs/Dockerfile` |

**Gemini** (conferido em aistudio.google.com/docs em 2026-11-02):
- Geração: `gemini-3.8-flash` (novo), `gemini-3.6-flash`, `gemini-3.5-flash-lite` e `gemini-3.1-flash-lite` (estáveis), todos com camada gratuita.
- Embeddings: `gemini-embedding-001` (só texto; aceita `taskType`; 768 dimensões recomendadas) e `gemini-embedding-2` (multimodal; sem `taskType`).
- Limites **por projeto** (não por chave); o diário zera à meia-noite do Pacífico. A documentação não publica os números da camada gratuita: só o AI Studio mostra os do seu projeto. Sites de terceiros falam em ~20/dia para os Flash e ~500/dia para os Flash-Lite (não confirmado).
- Camada gratuita: **"Content used to improve our products"**. Precisa constar na Política de Privacidade.

**Vercel AI SDK** (lido nos pacotes, que trazem a documentação da versão em `node_modules/ai/docs`):
- `ai` 7.0.159, `@ai-sdk/google` 4.0.109, `@ai-sdk/react` 4.0.163 (30/10): versões compatíveis entre si, com React 19.3 e com zod 4.
- `createGoogle({ apiKey })` aceita uma função como `apiKey`: dá para ler o secret a cada chamada. Embeddings por `google.embedding('gemini-embedding-001')` com `providerOptions.google: { outputDimensionality, taskType }`. `embed()` usa o endpoint simples (limite maior); `embedMany()`, o de lote.
- Na v7, `result.toUIMessageStreamResponse()` está **depreciado**: usar `toUIMessageStream()` + `createUIMessageStreamResponse()`.
- **Os avisos do SDK no navegador vão para `console.warn`** (opção não suportada, API depreciada). Qualquer aviso reprova: usar só API atual e conferir com o teste de tela.
- `useCompletion` ignora o `AbortError` ao parar e não escreve no console; o código da UI do SDK não tem `console.*`.
- Mock oficial: `MockLanguageModelV4` e `MockEmbeddingModelV4` (`ai/test`) + `simulateReadableStream`.
- Passar o modelo sempre como `google('…')`. **Nunca** como string (`"google/…"`): isso vai pelo AI Gateway da Vercel, que exige outra conta.

**Divergências a corrigir nos docs (etapa 1):** [llm.md](../../decisoes/llm.md) e [decisoes/README.md](../../decisoes/README.md) ainda propõem embeddings locais e "interface própria de provedor"; MODULOS diz que o RAG depende do catálogo, mas o indexador aplica o próprio filtro.

## 3. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 ✅ | **Vercel AI SDK 7** para o transporte; busca, prompts, limiar e rate limit escritos por nós (sem LangChain) | Hooks prontos com parar, estado e erro; o que o avaliador pergunta continua em código seu |
| D2 ✅ | Descrições das trilhas **só com dados reais + inferência pelo nome**; a riqueza vem da Wikipedia (seção 4) | Informação falsa sobre lugar real num app de trilha é problema de segurança e de credibilidade |
| D3 ✅ | **Não** criar trilhas que não existem | Poluiria o catálogo, o mapa, o ranking e o dashboard |
| D4 ✅ | As mudanças na área do Gabs (Docker, Makefile, schema) entram no plano, **marcadas ⚠️ Gabs**, em commits separados; o Edu avisa o Gabs, que revisa | Acréscimos de poucas linhas (seção 7) |
| D5 | Embeddings: `gemini-embedding-001`, 768 dimensões, `RETRIEVAL_DOCUMENT` no corpus e `RETRIEVAL_QUERY` na pergunta | Só texto; 768 cabe no índice do pgvector e reduz o arquivo |
| D6 | Embeddings do corpus calculados **uma vez** na sua máquina e **versionados** (`prisma/data/rag/index.jsonl`); o container só carrega o arquivo | Não sabemos como o lote conta na cota. Na avaliação, o `make` de um clone limpo não gasta cota nem depende da API para montar o índice |
| D7 | Modelo em `LLM_MODEL`. Dev: `mock`. Testes reais e demo: `gemini-3.5-flash-lite`, ou um Flash se o AI Studio mostrar cota | A cota gratuita dos Flash pode ser de ~20/dia |
| D8 | Não guardar perguntas, planos nem a memória no servidor; só o contador do rate limit | Menos dado pessoal (GDPR) e nada a notificar |
| D9 ✅ | **Só páginas** (`/planejar`, `/perguntar`), sem widget flutuante | Nada no layout raiz (área da Juh); um erro de console fica restrito a uma página; os dois módulos ficam visivelmente separados |
| D10 ✅ | **Memória só dentro do chat atual**: resumo da conversa + últimas 3 trocas literais; a pergunta de seguimento é reescrita como pergunta completa antes da busca. Recarregar a página ou "Nova conversa" esquece tudo; nada de memória entre chats | Faz "e ela é difícil?" funcionar; contexto com tamanho limitado; nada salvo |

Dependências a aprovar com este plano (versão exata): `ai@7.0.159`, `@ai-sdk/google@4.0.109`, `@ai-sdk/react@4.0.163`.

## 4. Dados do RAG: avaliação da sua ideia

| Ideia | Avaliação | Decisão |
|---|---|---|
| IA escreve uma descrição de cada trilha a partir dos dados reais (distância, desnível, dificuldade, piso, circular, tempo) | **Boa.** Texto corrido funciona muito melhor na busca semântica do que números soltos. Custa ~10 chamadas (10 trilhas por chamada, saída em JSON) | Fazer uma vez, num script; salvar em `prisma/data/rag/trilhas.json` (versionado, revisado por você). Só no corpus do RAG: não muda o `Trail.description` (catálogo do Gabs) |
| Acrescentar atributos inventados ("passa por cachoeiras", "boa para observar aves") | **Arriscado.** É informação falsa sobre lugares reais. O usuário pode ir esperando água ou cachoeira; o avaliador pode perguntar "isso é verdade?" | Enriquecer com o que é real: (1) **região/parque calculado pela coordenada** (tabela de ~12 regiões: Cantareira, Jaraguá, Japi, Paranapiacaba, Morro Grande…); (2) **artigos da Wikipedia desses parques**. O RAG junta "a trilha fica na Cantareira" + "a Cantareira abriga N espécies de aves", que é exatamente o que o módulo demonstra. Inferir pelo nome pode ("Trilha da Cachoeira do Funil" → cachoeira). **Nunca** inventar água potável, estrutura, sinal de celular ou segurança |
| Criar trilhas que não existem | **Não recomendo.** O `Trail` é o catálogo: a trilha apareceria no mapa com percurso falso (`routeGeoJSON` é obrigatório), no ranking, no dashboard e na exportação | O "grande conjunto de dados" vem da Wikipedia (~1.500 trechos), não do número de trilhas. Para o catálogo ter mais trilhas, o caminho é o filtro pendente em [dados-trilhas.md](../../dados-trilhas.md#pendências) |

**Corpus** (meta: ~2.000 trechos, número mostrado na tela):

| Fonte | Como | Estimativa |
|---|---|---|
| Wikipedia (pt) | ~80 artigos: parques, picos, serras, represas, municípios da região, Mata Atlântica e fauna. API do MediaWiki (`prop=extracts`, texto puro), uma vez, salvo no repo. CC BY-SA: título + link na fonte | 1.300–1.800 trechos |
| Trilhas | ~90 descrições geradas (acima) | 100–200 |
| Guias | ~25 textos gerais: segurança, o que levar, clima de SP por estação, animais, o que fazer se se perder, etiqueta, como o app calcula a dificuldade. Escritos com IA, revisados por você. Sem afirmações sobre lugares específicos | 80–150 |

Trechos de ~800 caracteres, cortados em parágrafo, com ~150 de sobreposição; cada trecho começa com o título do documento (melhora a busca).

## 5. Critérios de aceite

As caixas dos módulos 7 e 8 em [MODULOS.md](../../MODULOS.md#edu--ia-e-complementos), mais:
- [ ] Texto aparece aos poucos (visível com Network → Slow 4G)
- [ ] Parar cancela também a geração no Gemini (log no servidor)
- [ ] Rate limit por usuário (por minuto e por dia): o servidor responde 429 com `retryAfter`; a tela desabilita o botão com contagem **antes** de chegar ao 429
- [ ] Provedor fora do ar (chave inválida, cota do Google esgotada, timeout) → mensagem amigável, página intacta
- [ ] "Não encontrei" sem gerar resposta quando o melhor trecho fica abaixo do limiar
- [ ] Seguimento funciona: "tem trilha com cachoeira?" → "e ela é difícil?" responde sobre a mesma trilha
- [ ] Memória limitada: o servidor recebe só a pergunta, as últimas 3 trocas e o resumo (≤ 1.000 caracteres), nunca o histórico inteiro
- [ ] "Nova conversa" e recarregar a página esquecem a conversa; nada da conversa fica no banco
- [ ] Fontes com título, link e licença; resposta cita [1], [2]
- [ ] Busca avaliada: 20 perguntas de teste, documento certo entre os 5 primeiros em ≥ 80%
- [ ] Sem login → 401; entrada inválida → 400 (zod no front e no back)
- [ ] Clone limpo → `make` → índice carregado sem chamar a API
- [ ] Console limpo em **todos** os estados (gerando, parado, limite, erro do provedor), inclusive sem avisos do AI SDK
- [ ] Nada na lista de notificações (nada é criado, editado ou excluído)

## 6. Desenho

**Arquivos** (`apps/web/`):

```
src/lib/validation/ai.ts        zod do planejador e da pergunta (formulário e servidor)
src/server/ai/
  model.ts                      languageModel() e embeddingModel(): Gemini ou mock, por LLM_PROVIDER.
                                Único arquivo que conhece provedores; chave por readSecret('gemini_api_key')
  mock.ts                       MockLanguageModelV4: texto fixo em pedaços, com atraso;
                                "[falha]" na entrada simula queda do provedor
  errors.ts                     friendlyError(erro) → mensagem amigável (onError do stream)
  rate-limit.ts                 consumeAiQuota(userId), getAiQuota(userId)
  planner.ts                    prompt do planejador
  rag/memory.ts                 reescreve a pergunta de seguimento e atualiza o resumo da conversa
  rag/retrieve.ts               embedding da pergunta + busca no pgvector ($queryRaw)
  rag/prompt.ts                 trechos numerados + resumo + últimas trocas + regras
src/app/api/ai/plan/route.ts    POST
src/app/api/ai/ask/route.ts     POST
src/app/(assistente)/planejar/  page.tsx (Server Component) + formulário com useCompletion
src/app/(assistente)/perguntar/ page.tsx (Server Component) + conversa com useChat
prisma/data/rag/                wikipedia.json, trilhas.json, guias/*.md, index.jsonl (texto + vetores)
prisma/index-rag.mts            carrega index.jsonl no banco (--if-empty no start); não chama a API
scripts/ai-smoke.mts            confere chave, modelos e dimensões
scripts/rag/                    fetch-wikipedia, describe-trails, build-index (chama a API), eval
```

**Dados** (duas migrations, uma por PR; ⚠️ Gabs revisa):

```prisma
// Rate limit: um contador por usuário e janela fixa, em UTC ("2026-11-02T13:05" = minuto, "2026-11-02" = dia)
model AiUsage {
  userId String
  period String  // não "window": WINDOW é palavra reservada no Postgres
  count  Int    @default(0)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)  // + 1 linha em User
  @@id([userId, period])
}

enum RagSource { TRAIL WIKIPEDIA GUIDE }

model RagDocument {
  id              String     @id  // "wiki:Parque Estadual da Cantareira", "trail:TRL-462114253", "guide:o-que-levar"
  source          RagSource
  title           String
  url             String?
  license         String?         // "CC BY-SA 4.0", "ODbL"
  trailExternalId String?         // liga ao Trail pelo externalId: o id do Trail muda de máquina para máquina
  chunks          RagChunk[]
}

model RagChunk {
  id         Int         @id @default(autoincrement())
  documentId String
  document   RagDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String
  embedding  Unsupported("vector(768)")
  @@index([documentId])
}
```

- Rate limit: `upsert` com `{ increment: 1 }` nas duas janelas; recusa se alguma passar do limite. O Prisma faz `INSERT … ON CONFLICT` (atômico): duas abas juntas não furam o limite. Um teste com 10 chamadas em paralelo prova. No banco, não em memória, para o teto diário sobreviver a um restart.
- Busca: `ORDER BY embedding <=> $1::vector LIMIT k` (distância de cosseno). **Sem índice HNSW**: busca exata em ~2.000 linhas leva poucos ms; o HNSW é aproximado e só compensa com dezenas de milhares.

**API**

| Rota | Entrada | Erros antes do stream |
|---|---|---|
| `POST /api/ai/plan` | `{ trailId, date: "AAAA-MM-DD", experience: BEGINNER\|INTERMEDIATE\|EXPERIENCED, hours: 1–12, notes?: ≤ 300 }` | 400, 401, 404 `TRAIL_NOT_FOUND`, 429 `AI_RATE_LIMITED` (`retryAfter`) |
| `POST /api/ai/ask` | `{ question: 3–500, recent: até 3 × { question, answer }, summary?: ≤ 1.000 }`. O transporte do `useChat` monta esse corpo (`prepareSendMessagesRequest`) em vez de mandar o histórico inteiro | 400, 401, 429 |

Resposta: o protocolo de stream de UI do AI SDK (SSE, um JSON por linha `data: …`). Principais partes:
```
data: {"type":"data-sources","data":[{"n":1,"title":"…","url":"…","license":"…","score":0.81}]}   ← só no /ask
data: {"type":"data-memory","data":{"summary":"…"}}                                              ← só no /ask
data: {"type":"text-delta","id":"…","delta":"…"}                                                 ← vários
data: {"type":"error","errorText":"O assistente está indisponível agora…"}                       ← falha no meio
```
- **Planejador:** `streamText({ model, system, prompt, abortSignal, maxRetries: 1 })` → `createUIMessageStreamResponse({ stream: toUIMessageStream(...) })`; na tela, `useCompletion` (`complete('', { body })`, `stop()`, `isLoading`, `error`).
- **Perguntas:** `createUIMessageStream({ execute })`, em 4 passos:
  1. **Memória** (só se já houver trocas): uma chamada `generateText` com `Output.object` recebe o resumo, as últimas 3 trocas e a pergunta, e devolve `{ question, summary }`: a pergunta reescrita como completa ("e ela é difícil?" → "A Trilha da Cachoeira do Funil é difícil?") e o resumo atualizado (≤ 1.000 caracteres). Escreve `data-memory`.
  2. **Busca:** embedding da pergunta completa → top-k no pgvector → escreve `data-sources`.
  3. Abaixo do limiar: escreve "não encontrei" sem gerar resposta.
  4. Senão: `merge` do `streamText` com regras + resumo + últimas 3 trocas + trechos numerados + pergunta.

  Na tela, `useChat`: fontes pela parte `data-sources`, texto pelas partes `text`; o resumo da última `data-memory` fica no estado do componente e volta no próximo pedido. Custo: 1 chamada a mais ao Gemini por pergunta de seguimento (a primeira pergunta não tem).
- **Memória fica no navegador, não no servidor:** o servidor não guarda nada entre pedidos. O resumo e as trocas vivem no estado da página; por isso recarregar ou "Nova conversa" esquece tudo, e não existe memória entre chats. O resumo vindo do navegador é validado (tamanho) e entra no prompt entre delimitadores, como dado, nunca como instrução.
- **Por que o erro vem dentro do stream:** o Chrome mostra no console toda resposta 4xx/5xx de `fetch`, e console com erro reprova. Depois de validar e consumir a cota, a rota responde 200, e qualquer falha do provedor (inclusive o embedding da pergunta) vira a parte `error`, com o texto de `friendlyError`. O hook expõe em `error`.
- **429 sem aparecer no console:** a página (Server Component) lê a cota do banco e desabilita o botão com contagem; ao terminar cada pedido, `router.refresh()` atualiza a cota. O 429 continua existindo para quem chama direto (demonstrável por `curl`).
- **Parar:** o hook aborta o `fetch`; no servidor, `request.signal` (+ timeout de 60 s, `AbortSignal.any`) vai como `abortSignal` do `streamText`.
- O planejador busca a trilha com `getTrail` (não confia no cliente) e avisa que o desnível é estimado.

**UI** (Tailwind com os tokens que já existem; troca pelos componentes da Juh quando saírem). Duas páginas no menu ("Planejar" e "Perguntar"); até o layout da Juh existir, acesso pela URL.
- Planejador: trilha (`<select>` com as ~90 reais; `?trilha=<id>` pré-seleciona), data, experiência, horas, observações → Gerar; texto em streaming numa região `aria-live`; Parar; Tentar de novo; cota restante; aviso "a IA pode errar e não considera a previsão do tempo".
- Perguntas (chat): exemplos clicáveis quando a conversa está vazia; perguntas e respostas em sequência; resposta com [n]; fontes de cada resposta com score, link e licença (trilha → "Planejar esta trilha"); botão **Nova conversa**; bloco recolhível "O que o assistente lembra desta conversa" (mostra o resumo; ajuda a explicar a memória na avaliação); aviso "a conversa é esquecida ao recarregar"; "Base: N trechos de M documentos".
- Texto da IA como texto puro (`whitespace-pre-wrap`); o prompt pede listas com "- " e nada de tabelas. Nada de `dangerouslySetInnerHTML` e nenhuma lib de markdown.

## 7. Impacto em outras pessoas

**Dá para fazer quase sem mexer no código dos colegas.** O que é meu fica em pastas novas (`server/ai/`, `app/(assistente)/`, `api/ai/`, `data/rag/`). Fora delas, só acréscimos pequenos. Os itens **⚠️ Gabs** são da área dele: avise antes da etapa em que aparecem.

| Pessoa | O que muda | Etapa | Avisada? |
|---|---|---|---|
| ⚠️ **Gabs** (Docker) | `docker-compose.yml`: secret `gemini_api_key` + 4 variáveis no `nextjs`. `Makefile`: cria o secret vazio (como o OAuth). `.env.example`: `LLM_PROVIDER`, `LLM_MODEL`, `AI_LIMIT_PER_MINUTE`, `AI_LIMIT_PER_DAY`. nginx: nada | 1 | [ ] |
| ⚠️ **Gabs** (schema) | Migration `AiUsage` + 1 linha em `User` (`aiUsage AiUsage[]`) | 2 | [ ] |
| ⚠️ **Gabs** (schema + Docker) | Migration `RagDocument`/`RagChunk` (com `CREATE EXTENSION vector`); `entrypoint.sh`: 1 linha (`index-rag --if-empty`, sem bloquear a subida, como o `import-trails`); `Makefile`: alvo `index-rag` | 5 | [ ] |
| Di | Nenhum código. Pedir 3 frases em Privacidade e Termos: as perguntas vão ao Google Gemini, e na camada gratuita o Google usa o conteúdo; a IA pode errar; Wikipedia CC BY-SA. `AiUsage` some em cascata na exclusão | 8 | [ ] |
| Juh | Nenhum. Quando o layout sair: links "Planejar" e "Perguntar" na navegação | — | [ ] |
| Rafa | Nenhum (nada a notificar) | — | — |
| Catálogo | Opcional: botão "Planejar com IA" na página da trilha → `/planejar?trilha=<id>` (vira linha em TECNICO → interfaces) | 3 | [ ] |

## 8. Etapas

Uma etapa = uma revisão sua. Todas as etapas na branch `feat/ia-planejador`, sem PR por enquanto (pedido do Edu em 2026-11-02; antes: PR 1 com 1–3 e PR 2 com 4–7). **(central)** = parte que o avaliador vai pedir para explicar ou mudar: vale você reescrever sem olhar depois de revisar.

**Etapa 1. Fundação e chave**
- *Você antes:* criar a chave em aistudio.google.com e colar em `docker/secrets/gemini_api_key.txt`; anotar em AI Studio → Rate limit os limites de Flash, Flash-Lite e Embedding do seu projeto. ⚠️ Avisar o Gabs (Docker).
- *Eu:* as 3 dependências com versão exata; secret e variáveis (commit `feat(docker)` separado, para o Gabs revisar); `model.ts`, `mock.ts`, `errors.ts`; `scripts/ai-smoke.mts`; decisões em `llm.md` e `decisoes/README.md`.
- *Testar:* `make` com o secret vazio sobe normal; o smoke imprime modelo, dimensões (768) e similaridade de 2 frases; chave errada → mensagem amigável; `make test` (unit do mock e do `friendlyError`).

**Etapa 2. Planejador no servidor**
- *Eu:* ⚠️ migration `AiUsage`; `rate-limit.ts` **(central)**; zod; prompt **(central)**; `POST /api/ai/plan`.
- *Testar:* Vitest com o mock: 401, 400, 404; o stream traz `text-delta`; falha do provedor vira a parte `error` com a mensagem amigável; 10 chamadas em paralelo com limite 5 → exatamente 5 passam. `tests/test-ai.sh`: `curl -N` mostra o texto chegando aos poucos pelo nginx; 6ª chamada → 429. Interromper o `curl` → log de cancelamento no servidor.

**Etapa 3. Tela do planejador → módulo 7 completo**
- *Eu:* `/planejar` e o formulário com `useCompletion` **(central: como o stream chega e como o Parar funciona)**; docs (MODULOS, README, TECNICO). Abrir o PR 1.
- *Testar:* `tests/ui/test_ai_planner.py` (mock): gerar, parar, erro simulado, estourar o limite pela tela, console limpo. Depois, manual no Chrome com o Gemini real (1–2 planos) e Slow 4G.

**Etapa 4. Corpus (só dados, sem código do app)**
- *Eu:* `fetch-wikipedia.mts` + lista de artigos; ~25 guias; `describe-trails.mts` + tabela de regiões.
- *Testar:* contagens (artigos, caracteres, trilhas); você lê 10 descrições e 5 guias e confere se nada foi inventado.
- *Você revisa:* a lista de artigos, as regras da descrição, os guias.

**Etapa 5. Índice e busca**
- *Você antes:* ⚠️ avisar o Gabs (migration com vetor, linha no entrypoint, alvo no Makefile).
- *Eu:* ⚠️ migration `RagDocument`/`RagChunk`; `build-index.mts` (trechos + `embedMany` em lotes, com pausa e retomada); `index-rag.mts` + ⚠️ entrypoint + `make index-rag`; `retrieve.ts` **(central)**; `eval.mts` (20 perguntas + 5 fora do tema).
- *Testar:* `make index-rag` → contagem no `psql`; eval com acerto@5 ≥ 80% e escolha do limiar; Vitest de `retrieve` com `MockEmbeddingModelV4` e vetores feitos à mão (ordem e limiar), sem API.

**Etapa 6. Perguntas, ainda sem memória → módulo 8 completo**
- *Eu:* `POST /api/ai/ask` (passos 2–4 do desenho); prompt do RAG **(central)**; `/perguntar` com `useChat` e Nova conversa; docs.
- *Testar:* Vitest: "não encontrei" não gera resposta (o mock conta as chamadas); fontes chegam antes do texto. `test-ai.sh` e `tests/ui/test_ai_ask.py`. Manual com o Gemini: 10 perguntas do eval + 3 fora do tema.

**Etapa 7. Memória do chat**
- *Eu:* `rag/memory.ts` (passo 1 do desenho) **(central)**; corpo enxuto pelo `prepareSendMessagesRequest`; `data-memory`; bloco "O que o assistente lembra". Abrir o PR 2.
- *Testar:* Vitest com o mock: sem trocas anteriores não há chamada de memória; com trocas, a busca usa a pergunta reescrita; resumo acima de 1.000 caracteres → 400; mais de 3 trocas → 400. Teste de tela: pergunta → seguimento → "Nova conversa" zera o resumo; console limpo. Manual com o Gemini: conversa de 6 perguntas com seguimentos ("e ela?", "e a outra?"), conferindo o resumo a cada passo.

**Etapa 8. Fechamento**
- Clone limpo → `make` → índice carregado sem API → roteiro do bloco 7 de [AVALIACAO.md](../../AVALIACAO.md#roteiro-da-demonstração) inteiro, com o DevTools aberto.
- README (Technical Stack, Database Schema, Resources: uso de IA); texto da Di em Privacidade/Termos; chave reserva de **outro projeto** do Google (a cota é por projeto).

## 9. Como testar no estágio atual

Nada aqui espera os colegas: o login (Di) e as trilhas no banco (Gabs) já existem; não preciso do catálogo, do design system, do layout nem do `notify()`. Com `LLM_PROVIDER=mock`, tudo roda sem chave e sem gastar cota; o Gemini real só no fim de cada etapa.

| Camada | Ferramenta (já existe) | Para a IA |
|---|---|---|
| Unit | Vitest, `tests/unit/` | prompts, mock, `friendlyError` |
| Integração | Vitest + banco `_test` + `signInAs()` | rotas chamadas direto com um `Request`, lendo o stream; rate limit em paralelo; `retrieve` com vetores fixos; memória com o mock devolvendo `{ question, summary }` |
| HTTP pelo nginx | bash + curl (como `tests/test-trails.sh`) | `tests/test-ai.sh`: 401, 400, streaming, 429 |
| Qualidade da busca | — | `scripts/rag/eval.mts`: acerto@5 e limiar |
| Tela + console | Python + Chrome sem janela (`tests/ui/browser.py`) | `test_ai_planner.py`, `test_ai_ask.py` |
| Manual | Chrome com DevTools | Slow 4G, Parar, limite, chave inválida (editar o arquivo do secret vale na hora, sem rebuild, porque a chave é lida a cada chamada) |

Acesso às telas: pela URL (`/planejar`, `/perguntar`), logado como `alice@example.com` / `trilhas-dev-123`, até a Juh ter a navegação.

## 10. Riscos

1. **Cota gratuita pequena** (talvez ~20/dia nos Flash): mock no dev, Flash-Lite nos testes reais, chave reserva de outro projeto no dia.
2. **Google usa o conteúdo na camada gratuita:** aviso na tela + Privacidade (Di); o app não envia nome nem e-mail.
3. **Cota de embeddings ao montar o índice:** `build-index` roda uma vez, retoma de onde parou, e o resultado fica versionado (~8–10 MB; com 512 dimensões, ~6 MB).
4. **Console:** 429 e 5xx evitados pela tela; avisos do AI SDK (`console.warn`) evitados usando só API atual; o teste de tela confere.
5. **AI SDK muda rápido** (v5 → v7 em ~12 meses): versões fixas; a doc da versão instalada fica em `node_modules/ai/docs`.
6. **Ids de modelo mudam:** ficam em `LLM_MODEL`; o smoke test confere.
7. **Memória gasta cota:** 1 chamada a mais por pergunta de seguimento. O rate limit conta pedidos do usuário, não chamadas ao Gemini: na demo, conversas curtas.
8. **Resumo forjado pelo usuário** (ele vem do navegador): só afeta a própria conversa; tamanho validado e texto tratado como dado no prompt.

## 11. Para eu explicar na avaliação

- Diferença entre os módulos: o 7 é a interface (streaming, parar, erros, limite); o 8 é recuperar contexto de uma base própria e gerar a partir dele.
- O que o AI SDK faz (transporte: `streamText`, protocolo do stream, hooks) e o que eu escrevi (prompts, busca, limiar, rate limit, mensagens de erro). Por que não LangChain.
- Embedding; distância de cosseno; por que não há índice HNSW; por que os vetores ficam versionados.
- Trechos (tamanho, sobreposição, título no começo); `RETRIEVAL_DOCUMENT` × `RETRIEVAL_QUERY`.
- Como o limiar foi escolhido (eval) e por que "não encontrei" não gera resposta.
- Memória do chat: por que reescrever a pergunta antes da busca (o embedding de "e ela é difícil?" não sabe quem é "ela"); resumo móvel + janela das últimas 3 trocas, para o contexto não crescer sem limite; por que fica no navegador (nada salvo, GDPR) e por que não há memória entre chats.
- Como o stream chega ao navegador (SSE, partes `text-delta`); o que acontece no servidor ao apertar Parar; por que o erro vem dentro do stream.
- Rate limit: janela fixa, contador atômico no banco, por que não em memória.
- De onde vêm os dados: Wikipedia (CC BY-SA), OSM (ODbL), descrições geradas por IA a partir dos dados reais, guias do time.
- Modificações ao vivo prováveis: mudar o limite, o top-k ou o limiar; mudar a janela de 3 trocas ou o tamanho do resumo; acrescentar um guia e reindexar; mudar o prompt do planejador; acrescentar um campo ao formulário.

## 12. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-17 | Rascunho. Teste: `@huggingface/transformers` não roda em `alpine:3.24.2`; roda em `node:24-slim` |
| 2026-11-02 | Plano refeito para o Gemini: embeddings pela API (a imagem não muda), vetores versionados. Decidido com o Edu: AI SDK 7; descrições só com dados reais + Wikipedia; nenhuma trilha inventada; mudanças da área do Gabs marcadas ⚠️ para ele ser avisado |
| 2026-11-02 | Interface: só páginas, sem widget flutuante (D9). Memória dentro do chat: pergunta reescrita + resumo móvel + últimas 3 trocas, guardada no navegador; sem memória entre chats (D10). Memória vira a etapa 7 |
| 2026-11-02 | Plano aprovado. Etapa 1 implementada na branch `feat/ia-planejador`. Smoke com a chave real: streaming ok (1º pedaço em ~1,4 s), parar ok, embeddings com 768 dimensões; similaridade pergunta × trecho certo 0,76, trecho vizinho 0,64, fora do tema 0,50 (primeira pista para o limiar). Chave inválida → HTTP 400, que `friendlyError` trata como "indisponível" (teste unitário). Achado: `npm run lint` já falha no projeto inteiro (o `biome.json` não configura o formatador, e o código usa aspas simples e linhas longas); os arquivos de IA passam nas regras do lint (`biome lint`). Avisar o Gabs. As 5 vulnerabilidades do `npm audit` vêm do Prisma, não do AI SDK |
| 2026-11-02 | Etapa 2 implementada: migration `AiUsage` (coluna `period`, não `window`), `rate-limit.ts`, `planner.ts`, `POST /api/ai/plan`. A cota é consumida depois de validar a entrada e achar a trilha (400 e 404 não gastam); o rate limit apaga os contadores de dias anteriores. Testes: 24 de IA no Vitest (10 pedidos em paralelo com limite 5 → exatamente 5 passam, provando que o `upsert` é atômico) e `tests/test-ai.sh` pelo nginx, 21/21 (streaming ao longo de ~3,9 s, falha dentro do stream, cancelamento registrado no servidor ao fechar a conexão, 429). Uma chamada real ao Gemini pelo nginx: 16 pedaços entre 1,9 s e 3,8 s, nas seções pedidas, sem markdown; ele se apresentava, e o prompt ganhou "não se apresente". `docker/.env` local passou a `LLM_PROVIDER=mock`. Achados: (1) no Prisma 7 o `make migrate` não roda o `prisma generate`: o cliente só atualiza ao reiniciar o container ou com `generate` manual (avisar o Gabs); (2) o Node do Alpine não tem os dados de idioma pt-BR no `Intl` (`toLocaleString('pt-BR')` sai em inglês no servidor): datas do prompt formatadas à mão; vale avisar o time, porque data formatada no servidor e no navegador de jeitos diferentes causa erro de hidratação |
| 2026-11-02 | Etapa 3 implementada: `/planejar` com `useCompletion` (Parar, Tentar de novo, erro amigável) e a cota na tela, que desabilita o botão com contagem antes do 429 (`router.refresh()` depois de cada pedido e quando a janela acaba). A lista mostra as 88 trilhas reais (`src/server/ai/trails.ts`, mesmo critério do corpus). `tests/ui/test_ai_planner.py`: 24/24, console limpo. Achado: esta máquina não tem Chrome (o WSL não tem a `libnss3`); os testes de tela rodaram num Chromium 157 em container (`chromedp/headless-shell`), com `localhost:8443` repassado ao nginx. Falta o manual com o Gemini real e Slow 4G (Edu) |
| 2026-11-02 | Etapa 4 implementada. Wikipedia: 90 artigos, 1,15 milhão de caracteres (a API recusa com 429 quem pede rápido: 1 pedido por segundo, com `Retry-After`; 9 títulos da lista não existiam e foram trocados pelos certos). Trilhas: 88 descrições com `gemini-3.5-flash-lite` (9 pedidos), a partir dos dados do SQLite + região por retângulos desenhados sobre as coordenadas (22 regiões; a descrição diz "na região de"). Nenhuma inventou água, mirante ou fauna; a frase das "Trilha 6 km" saiu tautológica e foi corrigida à mão (4 trilhas) e no prompt. Guias: 28 textos, 27 mil caracteres. **A revisar pelo Edu:** a lista de artigos, a tabela de regiões (a mais incerta: Trilha da Cachoeira do Funil e o sudoeste) e os guias de saúde (picadas, febre amarela, carrapatos). Arquivos criados pelo container ficam com dono `root`: `chown` depois de rodar os scripts |
