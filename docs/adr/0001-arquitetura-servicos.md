# ADR-0001: Next.js como web/BFF + dois serviços satélites

- **Status:** Proposta
- **Data:** 2026-10-01 (revista em 2026-10-17: o catálogo de trilhas ficou no `web`, como no schema atual; o serviço `trails` saiu do plano)
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

- O time escolheu Next.js como framework full-stack e o módulo **"Backend as microservices"** (serviços pouco acoplados, interfaces claras, REST ou filas, responsabilidade única).
- O módulo de **tempo real** exige WebSockets. O Next.js não mantém conexões WebSocket de forma nativa nas rotas (a execução é por requisição); seria preciso um servidor customizado.
- O prazo é curto. Cada serviço a mais custa Dockerfile, contrato, deploy, observabilidade e pontos de falha.
- O schema implementado (`apps/web/prisma/schema.prisma`) colocou `Trail`, `Activity` e `Notification` no banco do `web`, junto com usuários e comunidades. A proposta original tinha um serviço `trails` com banco próprio.

## Decisão

Três serviços de aplicação:

| Serviço | Responsabilidade única | Estado |
|---|---|---|
| `web` (Next.js) | Interface, BFF e domínio: identidade, perfis, amizades, trilhas, atividades, comunidades, eventos, posts, notificações (gravação), emblemas, arquivos | Existe |
| `realtime` (Fastify + Socket.IO) | Comunicação em tempo real com usuários: conexões, presença, chat, entrega de notificações | Planejado |
| `ai` (Fastify) | Assistente: LLM e RAG | Planejado |

Cada um com banco próprio ([ADR-0003](0003-banco-de-dados.md)), contratos em `packages/contracts` e comunicação por REST interno + eventos ([ADR-0005](0005-comunicacao.md)). O nginx é a única entrada.

As fronteiras seguem **motivos técnicos reais**: processo de longa duração (WebSocket) e dependências, custos e limites de uso próprios (IA).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Serviço `trails` separado (proposta original) | Mais um serviço para defender o módulo; processamento geoespacial isolado | O schema já pôs as trilhas no `web`; atividades, autor e visibilidade de trilhas dependem de usuários; mais joins entre serviços |
| Monólito Next.js + servidor customizado para WebSocket | Mais simples | Perde o módulo de microsserviços (2 pts); servidor customizado perde otimizações do Next.js |
| Microsserviços "completos" (auth, users, communities, files, notifications… cada um separado) + API gateway | Divisão "de livro" | Muito mais trabalho e pontos de falha; joins distribuídos em tudo; incompatível com o prazo |
| Frontend React (SPA) + backend NestJS + serviços | Separação clássica | Mais boilerplate; perde SSR e Server Actions; não usa o Next.js como full-stack, que foi a decisão do time |

## Consequências

**Positivas:** número administrável de serviços; trilhas, atividades e usuários no mesmo banco (consultas e chaves estrangeiras simples); o WebSocket ganha um processo dedicado; a falha da IA (provedor fora, cota) não derruba o app.

**Negativas:** o `web` concentra quase todo o domínio, e um avaliador pode questionar se dois satélites bastam para o módulo. Há mais configuração (Docker, nginx, contratos).

**Riscos e mitigação:** questionamento do avaliador → demonstrar banco por serviço, contratos, comunicação síncrona e assíncrona e isolamento de falha (parar `ai` ou `realtime` sem derrubar o app); manter a camada de margem de pontos ([MODULES.md](../MODULES.md)). Se for preciso reforçar, o candidato natural a um terceiro serviço é o de **notificações** ou o de **ingestão/busca de trilhas**, decidido em nova ADR.

## 💡 Para aprender

- Monólito × monólito modular × microsserviços; quando cada um faz sentido.
- Padrão BFF (Backend for Frontend).
- "Decomposição por capacidade de negócio" × "por motivo técnico".
- Martin Fowler, *Microservices* e *MonolithFirst* (martinfowler.com).
