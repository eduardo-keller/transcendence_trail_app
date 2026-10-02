# ADR-0001: Next.js como web/BFF + três serviços satélites

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

- O time escolheu Next.js como framework full-stack e o módulo **"Backend as microservices"** (serviços pouco acoplados, interfaces claras, REST ou filas, responsabilidade única).
- O módulo de **tempo real** exige WebSockets. O Next.js não mantém conexões WebSocket de forma nativa nas rotas (a execução é por requisição); seria preciso um servidor customizado.
- O prazo é curto. Cada serviço a mais custa Dockerfile, contrato, deploy, observabilidade e pontos de falha.

## Decisão

Quatro serviços de aplicação:

| Serviço | Responsabilidade única |
|---|---|
| `web` (Next.js) | Interface, BFF e domínio principal (identidade, perfis, amizades, comunidades, arquivos, trilhas realizadas) |
| `realtime` (Fastify + Socket.IO) | Comunicação em tempo real com usuários: conexões, presença, chat, notificações |
| `trails` (Fastify + PostGIS) | Catálogo de trilhas: ingestão do OSM, busca geoespacial, elevação |
| `ai` (Fastify) | Assistente: LLM e RAG |

Cada um com banco próprio ([ADR-0003](0003-banco-de-dados.md)), contratos em `packages/contracts` e comunicação por REST interno + eventos ([ADR-0005](0005-comunicacao.md)). O nginx é a única entrada.

As fronteiras seguem **motivos técnicos reais**: processo de longa duração (WebSocket), processamento geoespacial com dados e ciclo de atualização próprios, e dependências, custos e limites de uso próprios (IA).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Monólito Next.js + servidor customizado para WebSocket | Mais simples | Perde o módulo de microsserviços (2 pts); servidor customizado perde otimizações do Next.js |
| Microsserviços "completos" (auth, users, communities, files, notifications… cada um separado) + API gateway | Divisão "de livro" | Muito mais trabalho e pontos de falha; joins distribuídos em tudo; incompatível com o prazo |
| Frontend React (SPA) + backend NestJS + serviços | Separação clássica | Mais boilerplate; perde SSR e Server Actions; não usa o Next.js como full-stack, que foi a decisão do time |

## Consequências

**Positivas:** atende ao módulo com um número administrável de serviços; cada frente tem um serviço ou área clara; o WebSocket ganha um processo dedicado; a falha da IA (provedor fora, cota) não derruba o app.

**Negativas:** o `web` concentra boa parte do domínio, e um avaliador pode questionar. Dados entre serviços exigem chamadas ou snapshots. Há mais configuração (Docker, nginx, contratos).

**Riscos e mitigação:** questionamento do avaliador → demonstrar banco por serviço, contratos, comunicação síncrona e assíncrona e isolamento de falha; manter a camada de margem de pontos ([MODULES.md](../MODULES.md)).

## 💡 Para aprender

- Monólito × monólito modular × microsserviços; quando cada um faz sentido.
- Padrão BFF (Backend for Frontend).
- "Decomposição por capacidade de negócio" × "por motivo técnico".
- Martin Fowler, *Microservices* e *MonolithFirst* (martinfowler.com).
