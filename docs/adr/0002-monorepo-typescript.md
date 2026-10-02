# ADR-0002: Monorepo pnpm, TypeScript em tudo, Fastify nos serviços

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

Quatro serviços, contratos compartilhados e cinco pessoas com prazo curto. Precisamos de uma única linguagem para que qualquer um consiga ler e revisar qualquer serviço (na avaliação, todos precisam explicar tudo).

## Decisão

- **Monorepo** com **pnpm workspaces**: `apps/web`, `services/*`, `packages/*`.
- **TypeScript** em todos os serviços (Node.js LTS).
- **Fastify** nos serviços satélites: leve, rápido, TypeScript de primeira, logs estruturados (pino) nativos, plugins e validação de schema.
- **zod** para validação e contratos, compartilhado via `packages/contracts`.
- **`packages/service-kit`**: base comum para os serviços Fastify (logger, tratamento de erros, `/health`, `/ready`, `/metrics`, verificação do token interno, encerramento gracioso). Todo serviço nasce igual.
- Sem Turborepo no início: `pnpm -r` e `--filter` bastam. Reavaliar se o build ficar lento.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Polyrepo (um repo por serviço) | Isolamento total | Contratos duplicados; 4 repos para coordenar; o histórico da entrega precisa ser um repo só |
| Python (FastAPI) no serviço de IA | Ecossistema forte de IA; muito pedido no mercado | Segunda linguagem e toolchain; contratos não compartilhados por tipo; os SDKs de LLM e as bibliotecas de embeddings em TS atendem ao que precisamos |
| Express | O mais conhecido, mais tutoriais | Validação e logs precisam de libs extras; TypeScript menos integrado |
| NestJS | Estrutura forte (módulos, DI) | Muito boilerplate para serviços pequenos; curva de aprendizado |

## Consequências

**Positivas:** uma linguagem; tipos compartilhados (um contrato quebrado vira erro de compilação); revisão cruzada facilitada; um único lockfile.

**Negativas:** o build Docker em monorepo exige cuidado (copiar só o necessário; Next.js `standalone` com `outputFileTracingRoot`). A F1 resolve isso no Sprint 0.

## 💡 Para aprender

- Workspaces do pnpm (`pnpm --filter`, `workspace:*`).
- Por que um monorepo facilita contratos tipados.
- Docker multi-stage em monorepo.
- Fastify: plugins, hooks e o ciclo de vida da requisição.
