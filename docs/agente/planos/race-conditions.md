# Plano: revisão de race conditions e integridade dos dados

- **Área / módulo(s):** Gabs / requisito eliminatório "sem corrupção de dados nem race conditions" ([AVALIACAO.md](../../AVALIACAO.md)); módulo 3
- **Status:** Em execução
- **Última atualização:** 2026-10-22

## 1. Objetivo

- Nenhuma escrita concorrente do código atual gera erro 500, dado inconsistente ou vazamento: no pior caso, a pessoa recebe um erro claro (404/409).
- Testes de integração que **provam** isso com requisições simultâneas (`Promise.all`), para mostrar na avaliação.
- Uma seção curta em [TECNICO.md](../../TECNICO.md) com as regras para o time (amizade, XP, emblemas e chat ainda vão ser escritos) e o que o Gabs precisa saber explicar.

Sem mudança no schema e sem migration.

## 2. Estado atual verificado

**O que já está protegido** (para explicar na avaliação):

| Situação | Proteção | Onde |
|---|---|---|
| Duas contas com o mesmo e-mail ao mesmo tempo | `@unique` no `User.email`: o banco recusa a segunda; o Better Auth responde 422 | `schema.prisma`; `test-all.sh` já confere |
| Importação do OSM rodando duas vezes ao mesmo tempo (`nextjs` + `prisma-studio` no primeiro start) | `@unique` no `Trail.externalId` + `upsert` (o Prisma usa `INSERT … ON CONFLICT`, atômico) | `import-trails.mts` |
| Estatísticas de atividades | Calculadas na hora (`aggregate`), nunca guardadas num contador: não existe "ler, somar, gravar" para dar errado | `activities/service.ts` |
| Trocar o dono de uma trilha ou atividade | Impossível: `authorId`/`userId` não estão nos schemas de edição | `lib/validation/` |
| Editar ou apagar algo que outra requisição acabou de apagar | O Prisma lança `P2025`, que o `toApiError` já transforma em 404 | `server/api/handler.ts` |
| Pares únicos já previstos | `@@unique` em `UserBadge (userId, badgeId)`, `CommunityMember`, `EventParticipant` | `schema.prisma` |

**O que encontrei** (padrão "confere e depois escreve", em duas consultas):

| # | Caso | O que pode acontecer | Gravidade |
|---|---|---|---|
| R1 | `createActivity`/`updateActivity` com `trailId`: confere a trilha (`findLinkableTrail`) e depois grava. Se o autor apagar a trilha entre as duas consultas | A chave estrangeira recusa (`P2003`), que **não** é tratada: **erro 500** "Erro interno" | Média |
| R2 | `updateTrail`, `deleteTrail`, `updateActivity`, `deleteActivity`: conferem o dono e depois escrevem só por `id` | Hoje seguro (o dono não muda), mas a regra "só o dono" depende de duas consultas. Basta um schema de edição aceitar `authorId` no futuro para virar falha | Baixa (defesa em profundidade) |
| R3 | Busca e lista (`count` + `findMany` no mesmo `$transaction`): no isolamento padrão do Postgres (*read committed*), cada consulta vê o banco num instante diferente | O `total` pode não bater com os itens se alguém criar ou apagar no meio (ex.: "21 resultados", mas a página 2 vem vazia) | Baixa |
| R4 | `exportUserData`: o Prisma faz várias consultas sem transação | O arquivo exportado pode misturar dois momentos (ex.: uma atividade de uma trilha que já sumiu do próprio arquivo) | Baixa |
| R5 | Vincular atividade a uma trilha que o autor tornou privada logo depois da conferência | A atividade fica ligada a uma trilha privada de outra pessoa; o título aparece na atividade de quem já o tinha visto quando era pública | Muito baixa: só anotar |

## 3. Critérios de aceite

- [ ] R1: com a trilha apagada no meio, a criação ou edição da atividade responde 404 `TRAIL_NOT_FOUND`, nunca 500
- [ ] R2: o dono entra no `where` da própria escrita; o teste do "outro usuário" continua dando 403/404
- [ ] R3 e R4: leituras em transação *repeatable read* (um único instante do banco)
- [ ] Testes de concorrência novos passam de forma estável (rodar `make test` 5 vezes seguidas)
- [ ] `make test` e `test-all.sh` continuam passando
- [ ] Seção "Concorrência" no TECNICO, com no máximo ~10 linhas
- [ ] Caixa "Sem corrupção de dados nem race conditions" marcada na AVALIACAO

## 4. Desenho

| # | Correção | Tamanho |
|---|---|---|
| R1 | `toApiError` passa a tratar `P2003` (chave estrangeira) como 409 genérico; no service de atividades, `P2003` no `trailId` vira `trailNotFound()` (404), igual a quando a trilha não existe | ~10 linhas |
| R2 | A escrita leva o dono no filtro: `update({ where: { id, authorId: userId } })` (o Prisma aceita campos extras junto do `id`). A conferência anterior continua, para devolver 403/404 com a mensagem certa; a escrita filtrada garante a regra mesmo se a conferência falhar | ~4 linhas por função |
| R3 | `prisma.$transaction([...], { isolationLevel: 'RepeatableRead' })` em `searchTrails` e `listActivities` | 1 linha cada |
| R4 | `exportUserData` dentro de `prisma.$transaction(async (tx) => …, { isolationLevel: 'RepeatableRead' })` | ~3 linhas |
| R5 | Nada no código; uma linha no TECNICO | — |

**Por que não um lock (`SELECT … FOR UPDATE`) no R1:** o Prisma não tem essa opção sem SQL puro, e a chave estrangeira já impede o dado errado. Basta transformar a recusa num erro claro. É mais simples de explicar: "o banco garante, o código traduz".

**Testes novos** (`tests/integration/concurrency.test.ts`), com `Promise.all`:
- 10 `deleteTrailAction` simultâneos da mesma trilha → exatamente 1 sucesso e 9 respostas 404, nenhum 500;
- `createActivityAction` com `trailId` ao mesmo tempo que `deleteTrailAction` dessa trilha (repetido 20 vezes) → cada criação termina em sucesso ou 404, nunca 500;
- 10 `updateActivityAction` simultâneos na mesma atividade → todos ok e o resultado final é um dos valores enviados (sem mistura de campos);
- R1 determinístico: um teste unitário de `toApiError` com um erro `P2003` simulado.

## 5. Impacto em outras pessoas

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Rafa | Regras no TECNICO para a `Friendship` (pedidos cruzados A→B e B→A viram **uma** amizade: `@@unique` no par ordenado) e para o chat (ordem por `createdAt` + `id`) | [ ] |
| Edu | Regras para XP e emblemas: somar com `{ increment: n }` (atômico), nunca "ler, somar, gravar"; emblema repetido barrado pelo `@@unique` que já existe | [ ] |
| Di | Nenhum código; a exportação dela fica consistente (R4) | [ ] |

## 6. Passos

**Agente (~45 min a 1 h, commits locais, sem push)**

- [ ] 1. `tests/integration/concurrency.test.ts` **antes** da correção. Rodar e registrar aqui o resultado: o R1 deve dar 500 hoje (prova de que o problema existe)
- [ ] 2. R1 + teste unitário do `P2003`. Commit `fix(web)`
- [ ] 3. R2. Commit `refactor(web)`
- [ ] 4. R3 e R4. Commit `fix(web)`
- [ ] 5. `make test` 5 vezes seguidas e `test-all.sh`. Commit `test(web)`
- [ ] 6. TECNICO (seção "Concorrência"). Commit `docs(docs)`
- [ ] 7. Rodar os testes de concorrência e mostrar ao Gabs a saída de **antes** (passo 1, com o 500) e de **depois** (tudo passando), lado a lado
- [ ] 8. Explicar o diff dos passos 2 a 4 ao Gabs: para cada correção (R1 a R4), o trecho antes e depois, em uma ou duas frases, ligado à pergunta de treino correspondente da seção 8. Na mensagem final, não num arquivo

**Gabs (~15 min, depois do passo 8)**

- [ ] 9. (10 min) Responder em voz alta as perguntas de treino da seção 8, sem olhar. Perguntar o que não ficar claro
- [ ] 10. (5 min) Se estiver tudo claro: marcar a caixa "Sem corrupção de dados nem race conditions" na AVALIACAO e autorizar o push

Tempo total: ~1 h do agente + ~15 min seus.

## 7. Como verificar

```bash
make dev
for i in 1 2 3 4 5; do make test args="tests/integration/concurrency.test.ts" || break; done
make test && bash tests/test-all.sh
```

## 8. Para eu explicar na avaliação

- Race condition: duas requisições leem o mesmo estado e decidem com base nele; quem escreve por último "ganha" ou o banco fica inconsistente.
- "Confere e depois escreve" (TOCTOU) e as três saídas: constraint no banco (`@unique`, chave estrangeira), escrita condicional (`where` com o dono) e transação.
- Por que contador guardado é perigoso e `aggregate`/`increment` não são.
- Isolamento de transação: *read committed* (padrão; cada consulta vê um instante) × *repeatable read* (a transação inteira vê um instante só).
- Como os testes com `Promise.all` provam o comportamento.

**Perguntas de treino** (passo 9):
1. Dois usuários se cadastram com o mesmo e-mail no mesmo milissegundo. O que acontece, e quem garante?
2. Se eu apagar uma trilha enquanto alguém registra uma atividade nela, o que acontece? E antes desta correção?
3. Por que não guardamos "total de km" numa coluna do usuário?
4. Como você garante que só o dono edita uma trilha, mesmo com duas requisições ao mesmo tempo?
5. Para que serve o `isolationLevel: 'RepeatableRead'` na busca?
6. Dois usuários se pedem amizade ao mesmo tempo (pergunta da AVALIACAO). Como o schema do Rafa deve evitar duas amizades?

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-22 | Plano criado depois de ler `trails/service.ts`, `activities/service.ts`, `gdpr/export.ts`, `import-trails.mts`, `server/api/handler.ts` e `schema.prisma` |
| 2026-10-22 | Passo 1: antes das correções, 4 dos 6 testes de concorrência falhavam: criar/editar atividade com a trilha apagada no meio → 500 (`P2003`), inclusive numa corrida real (20 rodadas de `Promise.all`), e a edição acontecia com o dono trocado no meio. 10 exclusões e 10 edições simultâneas já estavam corretas |
| 2026-10-22 | Passos 2 a 6 feitos. `make test` 5 vezes seguidas: 139/139 em todas; `test-all.sh` em produção: 348 ok. Cuidado: `biome format` reformata o arquivo inteiro (formatação do time não configurada), então não foi usado |
