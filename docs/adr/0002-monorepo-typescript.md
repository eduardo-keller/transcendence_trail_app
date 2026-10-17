# ADR-0002: Monorepo com npm, TypeScript em tudo, Fastify nos serviços

- **Status:** Proposta
- **Data:** 2026-10-01 (atualizada em 2026-10-17 para refletir o código: npm no lugar de pnpm, Biome)
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

Quatro serviços, contratos compartilhados e cinco pessoas com prazo curto. Precisamos de uma única linguagem para que qualquer um consiga ler e revisar qualquer serviço (na avaliação, todos precisam explicar tudo).

## Decisão

- **Monorepo** num único repositório git: `apps/web` (hoje), `services/*` e `packages/*` (previstos).
- **npm** como gerenciador de pacotes, com `package.json` e `package-lock.json` por app (hoje só `apps/web`). Quando `packages/*` existir e precisar ser importado pelos apps, adotar **npm workspaces** na raiz.
- **Biome** para lint e formatação.
- **TypeScript** em todos os serviços (Node.js LTS).
- **Fastify** nos serviços satélites: leve, rápido, TypeScript de primeira, logs estruturados (pino) nativos, plugins e validação de schema.
- **zod** para validação e contratos, compartilhado via `packages/contracts`.
- **`packages/service-kit`**: base comum para os serviços Fastify (logger, tratamento de erros, `/health`, `/ready`, `/metrics`, verificação do token interno, encerramento gracioso). Todo serviço nasce igual.
- Sem Turborepo no início. Reavaliar se o build ficar lento.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| pnpm workspaces (proposta original desta ADR) | Instalação rápida; workspaces maduros | Uma ferramenta a mais para o time; o código foi escrito com npm (commit `3adf507`) |
| Polyrepo (um repo por serviço) | Isolamento total | Contratos duplicados; 4 repos para coordenar; o histórico da entrega precisa ser um repo só |
| Python (FastAPI) no serviço de IA | Ecossistema forte de IA; muito pedido no mercado | Segunda linguagem e toolchain; contratos não compartilhados por tipo; os SDKs de LLM e as bibliotecas de embeddings em TS atendem ao que precisamos |
| Express | O mais conhecido, mais tutoriais | Validação e logs precisam de libs extras; TypeScript menos integrado |
| NestJS | Estrutura forte (módulos, DI) | Muito boilerplate para serviços pequenos; curva de aprendizado |

## Consequências

**Positivas:** uma linguagem; tipos compartilhados (um contrato quebrado vira erro de compilação); revisão cruzada facilitada.

**Negativas:** sem workspaces, cada app tem o próprio lockfile e compartilhar código exige configurar workspaces depois. O build Docker em monorepo exige cuidado (copiar só o necessário; Next.js `standalone` com `outputFileTracingRoot`).

## 💡 Para aprender

- npm workspaces (`npm -w <pacote>`).
- Por que um monorepo facilita contratos tipados.
- Docker multi-stage em monorepo.
- Fastify: plugins, hooks e o ciclo de vida da requisição.
