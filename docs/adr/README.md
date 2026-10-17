# Decisões de arquitetura (ADRs)

> Última atualização: 2026-10-17

Um **ADR** (Architecture Decision Record) registra **uma** decisão técnica importante: o contexto, o que foi decidido, as alternativas e as consequências. Serve para:
- não rediscutir a mesma coisa toda semana;
- explicar ao avaliador (e ao README, na seção "Technical Stack: justification") **por que** escolhemos cada coisa;
- dar contexto a agentes de IA, que leem os ADRs antes de propor mudanças estruturais.

## Quando escrever um ADR

Escreva quando a decisão afeta mais de uma frente, adiciona uma tecnologia ao projeto ou é difícil de reverter. Decisões locais de uma frente ficam na seção "Decisões" do README da frente.

## Como

1. Copie [0000-template.md](0000-template.md) para `NNNN-titulo-curto.md` (próximo número livre).
2. Status **Proposta**. Abra a PR com label `decisão` e avise no `#decisoes`.
3. Discussão na PR. O Tech Lead aprova e o status vira **Aceita**.
4. ADRs não são editadas depois de aceitas (exceto erros de digitação). Enquanto estão como **Proposta**, podem ser revistas para acompanhar o código (registre a data da revisão no cabeçalho). Mudou de ideia? Crie outro ADR que **substitui** o anterior e atualize o status do antigo para "Substituída por ADR-NNNN".

## Índice

| ADR | Título | Status |
|---|---|---|
| [0001](0001-arquitetura-servicos.md) | Next.js como web/BFF + dois serviços satélites (`realtime`, `ai`) | Proposta |
| [0002](0002-monorepo-typescript.md) | Monorepo com npm, TypeScript em tudo, Fastify nos serviços | Proposta |
| [0003](0003-banco-de-dados.md) | PostgreSQL: um servidor, um banco por serviço; Prisma; PostGIS e pgvector | Proposta (banco principal implementado) |
| [0004](0004-autenticacao.md) | Autenticação com Better Auth (sessão em cookie) | Proposta (configurado) |
| [0005](0005-comunicacao.md) | REST interno + Redis pub/sub + Socket.IO | Proposta |
| [0006](0006-dados-de-trilhas-osm.md) | Dados de trilhas: ingestão offline do OSM e seed versionado | Proposta |
| [0007](0007-provedor-llm-embeddings.md) | Provedor de LLM e embeddings | **Pendente** |
| [0008](0008-frontend-mapas.md) | Frontend: Tailwind + shadcn/ui, Leaflet, Recharts | Proposta |
| [0009](0009-armazenamento-arquivos.md) | Arquivos em volume local com acesso autenticado | Proposta |
