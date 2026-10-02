# Contratos entre serviços

> Última atualização: 2026-10-01 — versão inicial (tudo "Planejado").
> Donos: Tech Lead + dono de cada serviço produtor.

Um **contrato** é o acordo sobre como dois serviços conversam: rota, formato de entrada e saída, erros, eventos. É o que permite que cinco pessoas trabalhem em paralelo: cada uma programa contra o contrato, sem esperar a implementação da outra.

> 💡 **Conceito: contract-first.** Primeiro define-se a interface, depois implementa-se dos dois lados. Se o contrato é claro, o consumidor pode usar um mock enquanto o produtor implementa. Se o contrato muda sem aviso, algo quebra em produção (ou na avaliação).

## 1. Onde fica a verdade

- **Código:** `packages/contracts` (schemas zod + tipos TypeScript inferidos). Produtor e consumidor importam o **mesmo** schema, então uma mudança incompatível vira erro de compilação.
- **Este documento:** o **catálogo** (o que existe, quem produz, quem consome, status). Ele não repete o payload campo a campo; para isso, aponta para o schema.

## 2. Regras para mudar um contrato

1. **Mudança compatível** (campo opcional novo, endpoint novo): PR normal com label `contrato`, revisada pelo Tech Lead.
2. **Mudança incompatível** (remover ou renomear campo, mudar tipo, mudar semântica): **combine antes** com os donos dos consumidores. Faça em duas etapas (adicionar o novo → migrar os consumidores → remover o antigo) ou numa PR única que atualize produtor e consumidores juntos.
3. Atualize a tabela deste documento no mesmo PR.
4. Eventos têm o campo `version`. Mudança incompatível em evento = `version` + 1.

## 3. Convenções de REST interno

| Item | Convenção |
|---|---|
| Base URL | `http://<serviço>:<porta>` na rede interna (`trails:4002`, `ai:4003`, `realtime:4001`, `web:3000`) |
| Prefixo | Serviços satélites: `/v1/...`. No `web`: `/api/internal/...` (bloqueado no nginx para acesso externo) |
| Autenticação | Header `x-internal-token: $INTERNAL_API_TOKEN`; sem ele, 401 |
| Usuário | Header `x-user-id` (preenchido pelo `web` após validar a sessão) |
| Correlação | Header `x-request-id` propagado |
| Corpo | JSON; datas em ISO 8601 UTC |
| Erro | `{ "error": { "code": "SNAKE_UPPER", "message": "texto", "details": {} } }` com o status HTTP correto |
| Paginação | `?page=&pageSize=` → `{ items, page, pageSize, total }` |
| Timeout do cliente | 5 s (streams de IA: 60 s) |
| Streaming | Server-Sent Events (`text/event-stream`), eventos `token`, `sources`, `error`, `done` |

## 4. Endpoints internos (catálogo)

Status: 📝 planejado · 🟡 em implementação · ✅ implementado. **O plano de cada frente pode ajustar estas rotas**: atualize aqui quando isso acontecer.

### trails (F4)
| Método e rota | Uso | Consumidores | Status |
|---|---|---|---|
| `GET /v1/trails` | Busca com filtros, ordenação e paginação (parâmetros em [frentes/trilhas](../frentes/trilhas/README.md#api)) | web | 📝 |
| `GET /v1/trails/:idOrSlug` | Detalhe com geometria simplificada (GeoJSON) e perfil de elevação | web | 📝 |
| `GET /v1/trails/batch?ids=` | Resumo de várias trilhas (perfil, ranking) | web | 📝 |
| `GET /v1/trails/:id/gpx` | Exportar a trilha em GPX | web | 📝 |
| `GET /v1/trails/export` | Todas as trilhas em texto e metadados para indexação | ai | 📝 |

### ai (F5)
| Método e rota | Uso | Consumidores | Status |
|---|---|---|---|
| `POST /v1/rag/ask` | Pergunta com RAG, resposta em SSE com fontes | web | 📝 |
| `POST /v1/planner/generate` | Plano de trilha gerado por LLM, em SSE | web | 📝 |
| `GET /v1/rag/stats` | Contagem de documentos e trechos indexados | web (status / assistente) | 📝 |

### realtime (F3)
| Método e rota | Uso | Consumidores | Status |
|---|---|---|---|
| `GET /v1/conversations` | Conversas do usuário com contagem de não lidas | web | 📝 |
| `GET /v1/conversations/:id/messages` | Histórico paginado | web | 📝 |
| `GET /v1/notifications` | Notificações paginadas | web | 📝 |
| `POST /v1/notifications/read` | Marcar como lidas (`ids` ou `all`) | web | 📝 |
| `GET /v1/presence?userIds=` | Quem está online | web | 📝 |

### web (F2/F3), rotas internas
| Método e rota | Uso | Consumidores | Status |
|---|---|---|---|
| Endpoint de sessão do Better Auth (repasse do cookie) | Validar a sessão no handshake do socket | realtime | 📝 |
| `GET /api/internal/users/batch?ids=` | Nome, username e avatar para exibir no chat e nas notificações | realtime | 📝 |
| `GET /api/internal/users/:id/friends` | IDs dos amigos (fan-out de presença) | realtime | 📝 |
| `GET /api/internal/friendships/check?a=&b=` | São amigos? (autorizar o chat) | realtime | 📝 |

Todos os serviços também expõem `GET /health`, `GET /ready` e `GET /metrics` (via `service-kit`), consumidos pelo compose, pelo Prometheus e pela status page.

## 5. Eventos (Redis pub/sub)

Envelope comum (`EventEnvelope` em `packages/contracts`):
```ts
{ id: string; type: string; version: number; occurredAt: string;
  producer: "web" | "realtime" | "trails" | "ai"; actorId?: string; payload: unknown }
```

| Tipo | Canal | Produtor(es) | Consumidor(es) | Payload (resumo) | Status |
|---|---|---|---|---|---|
| `notification.requested` | `events:notifications` | web, realtime, trails | realtime | `recipientIds[]`, `kind`, `entity {type,id}`, `data` (texto e link) | 📝 |
| `community.activity` | `events:community` | web | realtime | `communityId`, `action` (post/comment created/updated/deleted), `entityId` | 📝 |
| `friendship.changed` | `events:social` | web | realtime | `userIds [a,b]`, `status` (requested/accepted/removed) | 📝 |
| `user.profile.updated` | `events:social` | web | realtime | `userId` (invalida o cache de nome e avatar) | 📝 |
| `trail.catalog.updated` | `events:trails` | trails | ai | `ingestionRunId`, `trailCount` (dispara a reindexação do RAG) | 📝 |

**Notificações:** quem produz o evento decide **quem** é notificado (`recipientIds`), porque é quem conhece o domínio (ex.: só o `web` sabe quem é membro de uma comunidade). O `realtime` apenas persiste e entrega. A lista de ações e destinatários é a [matriz de notificações](../frentes/social/README.md#matriz-de-notificações).

## 6. Eventos de socket (navegador ↔ realtime)

Salas: `user:<userId>` (tudo que é pessoal) e `community:<communityId>` (feed ao vivo; o cliente entra ao abrir a página da comunidade, depois que o servidor confere a permissão).

| Evento | Direção | Payload (resumo) | Observação | Status |
|---|---|---|---|---|
| `chat:send` | cliente → servidor (com ack) | `toUserId`, `text`, `clientMessageId` | Idempotente por `clientMessageId`; o ack devolve `id` e `createdAt` ou um erro | 📝 |
| `chat:message` | servidor → cliente | mensagem completa | Para remetente (outras abas) e destinatário | 📝 |
| `chat:typing` | ambos | `conversationId`, `isTyping` | Não persistido | 📝 |
| `chat:read` | cliente → servidor | `conversationId`, `lastReadMessageId` | | 📝 |
| `presence:changed` | servidor → cliente | `userId`, `online` | Só para amigos | 📝 |
| `notification:new` | servidor → cliente | notificação | | 📝 |
| `community:join` / `community:leave` | cliente → servidor | `communityId` | O servidor confere a permissão | 📝 |
| `community:activity` | servidor → cliente | igual ao evento `community.activity` | | 📝 |
| `sync:since` | cliente → servidor (com ack) | `since` (timestamp) | Na reconexão: devolve as mensagens e notificações perdidas | 📝 |
