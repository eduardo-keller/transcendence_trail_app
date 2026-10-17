# F3: Social em Tempo Real

> Última atualização: 2026-10-17 — alinhado ao código: `Notification` vive no banco principal (`web`); o `realtime` entrega ao vivo. Matriz atualizada com trilhas, atividades, eventos e emblemas.

| | |
|---|---|
| **Dono** | *a definir* |
| **Apoio** | *a definir* |
| **Módulos** | Tempo real (2), Interação entre usuários (2, com a F2), Notificações (1); amigos e status online do Gerenciamento de usuários |
| **Status** | ⬜ não iniciado (`Notification` já no schema) |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Fazer os usuários **se conectarem e conversarem**: amizades, presença online, chat e notificações, tudo em tempo real. Esta frente é dona do serviço `realtime` e do **sistema de notificações** que todas as outras frentes alimentam.

## 2. Escopo

**Dentro:**
- **Serviço `realtime`** (Fastify + Socket.IO, a partir do template da F1): autenticação no handshake, salas `user:<id>` e `community:<id>`, consumo de eventos do Redis, métricas de negócio.
- **Cliente de socket no `web`:** provider que conecta **só quando há sessão**, instância única (StrictMode em dev monta os componentes duas vezes), hooks com limpeza dos listeners, banner "reconectando…".
- **Amizades** (no `web`, modelo `Friendship` a criar no `schema.prisma`): pedir, aceitar, recusar, cancelar, remover, listar; página `/amigos`; publicação de `friendship.changed`.
- **Presença:** online/offline com várias abas e período de tolerância contra piscadas; enviada **só para amigos**.
- **Chat 1:1 entre amigos:** enviar com ack e idempotência, receber, histórico paginado, lista de conversas com não lidas, indicador de digitação, confirmação de leitura; página `/mensagens`; atalho "enviar mensagem" no perfil.
- **Notificações:** helper `notify()` no `web` que grava `Notification` e publica `notification.created`; entrega em tempo real pelo `realtime`; listar e marcar como lida (no `web`); sino no header com contador, página `/notificacoes`, toasts. **Mantém a matriz** (abaixo).
- **Feed de comunidade ao vivo:** repassar `community.activity` para a sala `community:<id>`.
- **Ressincronização** ao reconectar (`sync:since`).

**Fora:** perfil e edição (F2); conteúdo das comunidades (F2); chat em grupo; bloquear usuário (não é exigido pelo módulo básico).

## 3. Critérios de aceite

Os critérios dos módulos 4 (amigos e online), 5, 6 e 10 estão em [MODULES.md](../../MODULES.md#5-interação-entre-usuários-major). Além deles:
- [ ] Com dois navegadores, a mensagem aparece no outro em < 1 s.
- [ ] Fechar uma de duas abas **não** deixa o usuário offline; fechar todas deixa (após a tolerância de ~5 s).
- [ ] Mensagem enviada duas vezes com o mesmo `clientMessageId` é gravada uma vez só.
- [ ] Pedidos de amizade cruzados (A→B e B→A ao mesmo tempo) resultam em **uma** amizade aceita.
- [ ] Nenhum erro no console ao abrir o site deslogado (o socket não tenta conectar).
- [ ] Toda linha da matriz de notificações verificada com dois usuários.

## 4. Desenho

### Dados

**Banco principal (`web`)**

| Modelo | Campos | Estado | Observações |
|---|---|---|---|
| Notification | id, message, isRead (padrão `false`), createdAt, userId | **Existe** | Índice `(userId, isRead)` para o contador de não lidas. Usuário apagado → notificações apagadas |
| Friendship | id, userAId, userBId, requesterId, status (`PENDING`/`ACCEPTED`), createdAt, updatedAt | A criar | **userAId < userBId** (ordem canônica) + `UNIQUE(userAId, userBId)`: impede duplicata e resolve o pedido cruzado |

Se a UI precisar de link ou ícone por tipo, adicione campos a `Notification` (ex.: `link`, `kind`) com migration.

**Banco `realtime`** (a criar junto com o serviço):

| Modelo | Campos | Observações |
|---|---|---|
| Conversation | id, userAId, userBId, lastMessageAt | `UNIQUE(userAId, userBId)` em ordem canônica |
| Message | id, conversationId, senderId, body (≤ 2.000 caracteres), clientMessageId, createdAt | `UNIQUE(senderId, clientMessageId)` (idempotência); índice (conversationId, createdAt) |
| ConversationRead | conversationId, userId, lastReadAt | Para contar não lidas |

### Presença (instância única do `realtime`)
- Mapa em memória `userId → Set<socketId>`; o primeiro socket marca online; ao esvaziar, um timer de 5 s marca offline (evita piscar no reload).
- Ao conectar, busca a lista de amigos (`/api/internal/users/:id/friends`, com cache) e avisa os amigos online. Invalida o cache ao receber `friendship.changed`.
- Opcional: espelhar no Redis (`SET presence:online`) para o `web` consultar e o Grafana contar.

### Eventos e sockets
Catálogo completo em [contracts/README.md](../../contracts/README.md#6-eventos-de-socket-navegador--realtime). Resumo: `chat:send` (ack), `chat:message`, `chat:typing`, `chat:read`, `presence:changed`, `notification:new`, `community:join` / `community:leave` / `community:activity`, `sync:since`.

Notificações de chat (gerada no `realtime`): o `realtime` chama `POST /api/internal/notifications` no `web`, que grava e publica como qualquer outra.

### Matriz de notificações

**Esta tabela define o que significa "notificações para todas as ações de criar, editar e excluir".** Cada dono de frente mantém as suas linhas. Uma ação nova no app é uma linha nova aqui, no mesmo PR.

- **Destinatários:** quem é afetado pela ação. Quem fez a ação recebe um **toast imediato** e, se não houver outro afetado, uma notificação para si mesmo ("self"), que pode ser filtrada à parte na central. Assim **toda** ação CRUD gera notificação persistida, sem encher o sino de ruído. *(Proposta: o PO valida no kickoff.)*

| Frente | Entidade | Ação | Notifica | Texto (exemplo) | Status |
|---|---|---|---|---|---|
| F2 | Conta | criar | o próprio (self) | "Bem-vindo(a) ao Trilhas SP!" | 📝 |
| F2 | Perfil | editar | o próprio (self) | "Seu perfil foi atualizado" | 📝 |
| F2 | Avatar / arquivo | criar | o próprio (self) | "Arquivo enviado: foto.jpg" | 📝 |
| F2 | Avatar / arquivo | excluir | o próprio (self) | "Arquivo excluído: foto.jpg" | 📝 |
| F3 | Pedido de amizade | criar | destinatário | "Ana quer ser sua amiga" | 📝 |
| F3 | Pedido de amizade | aceitar (editar) | solicitante | "Bruno aceitou seu pedido" | 📝 |
| F3 | Pedido de amizade | recusar ou cancelar (excluir) | o próprio (self) | "Pedido recusado" | 📝 |
| F3 | Amizade | excluir | o próprio (self); o outro (PO decide) | "Você desfez a amizade com Ana" | 📝 |
| F3 | Mensagem | criar | destinatário, se não estiver com a conversa aberta | "Nova mensagem de Ana" | 📝 |
| F2 | Comunidade | criar | o próprio (self) | "Comunidade X criada" | 📝 |
| F2 | Comunidade | editar | membros | "A comunidade X foi atualizada" | 📝 |
| F2 | Comunidade | excluir | membros | "A comunidade X foi excluída" | 📝 |
| F2 | Membro | entrar ou sair | `ADMIN`s | "Diego entrou em X" | 📝 |
| F2 | Membro | remover ou mudar papel | membro afetado | "Você agora é moderador de X" | 📝 |
| F2 | Post | criar | membros (menos o autor); post de perfil: amigos | "Nova publicação em X" | 📝 |
| F2 | Post | editar | o próprio (self) | "Publicação atualizada" | 📝 |
| F2 | Post | excluir | autor (se foi um moderador) ou self | "Sua publicação em X foi removida" | 📝 |
| F2 | Comentário | criar | autor do post | "Eva comentou na sua publicação" | 📝 |
| F2 | Comentário | editar | o próprio (self) | "Comentário atualizado" | 📝 |
| F2 | Comentário | excluir | autor (se foi um moderador) ou self | "Seu comentário foi removido" | 📝 |
| F2 | Evento | criar | membros da comunidade | "Nova saída em X: Pico do Jaraguá, 25/10" | 📝 |
| F2 | Evento | editar ou excluir | participantes | "A saída Pico do Jaraguá mudou de data" | 📝 |
| F2 | Participação em evento | criar ou excluir | organizador | "Carla vai participar da saída" | 📝 |
| F4 | Trilha | criar | o próprio (self); se pública, amigos | "Ana publicou a trilha Pedra Grande" | 📝 |
| F4 | Trilha | editar ou excluir | o próprio (self) | "Trilha atualizada" | 📝 |
| F4 | Atividade | criar | o próprio (self) + amigos | "Ana registrou 8,2 km na Trilha do Pico do Jaraguá" | 📝 |
| F4 | Atividade | editar ou excluir | o próprio (self) | "Atividade atualizada" | 📝 |
| F4 | Emblema | conquistar (criar) | o próprio | "Você ganhou o emblema 100 km" | 📝 |

## 5. Dependências

| Consome de | O quê | Enquanto não estiver pronto |
|---|---|---|
| F1 | Template de serviço, Redis, nginx com WebSocket | — (caminho crítico do M0) |
| F2 | Sessão (`requireUser`, endpoint de sessão), `users/batch` | Seed de usuários; o endpoint de sessão já vem do Better Auth |
| Todas | Chamadas a `notify()` nas ações | Um script de teste que cria notificações falsas |

| Fornece para | O quê |
|---|---|
| Todas | Helper `notify()`, contrato de `notification.created` (com o Tech Lead) e a matriz |
| F2 | Status online e lista de amigos no perfil |
| F2 | Feed ao vivo das comunidades |

## 6. Conceitos-chave

> 💡 **WebSocket.** Começa como uma requisição HTTP comum com o header `Upgrade: websocket`. Se o servidor aceita, a conexão TCP fica aberta e **os dois lados** podem enviar mensagens a qualquer momento. HTTP é sempre pergunta e resposta; WebSocket é um telefone aberto. Por isso o proxy (nginx) precisa de configuração especial para repassar o upgrade.

> 💡 **Socket.IO.** Uma biblioteca sobre WebSocket que adiciona **salas** (enviar para um grupo), **acks** (confirmação, como um "recebido"), **reconexão automática** e fallback. Broadcast eficiente = emitir só para a sala certa (`io.to("user:123")`), nunca `io.emit` para todos.

> 💡 **Idempotência.** Uma operação é idempotente se repeti-la não muda o resultado. Em rede, mensagens podem ser reenviadas (o ack se perdeu, o cliente tentou de novo). O `clientMessageId` com `UNIQUE` garante que a mensagem é gravada uma vez só.

> 💡 **Race condition.** Duas operações simultâneas que, juntas, deixam os dados inconsistentes. Exemplo: A e B se pedem amizade no mesmo instante e surgem duas linhas. A solução é deixar o **banco** garantir (constraint `UNIQUE` + ordem canônica dos IDs + tratar o erro de conflito), não o código ("verifica e depois insere" tem uma janela entre os dois passos). O schema já faz isso em `CommunityMember`, `EventParticipant` e `UserBadge`.

> 💡 **Entrega "no máximo uma vez" e ressincronização.** O pub/sub do Redis não guarda eventos. Se o cliente ficou desconectado, perdeu as mensagens daquele intervalo. Por isso, ao reconectar, o cliente pede "o que aconteceu desde T" (`sync:since`), e o servidor responde a partir do **banco**, que é a fonte da verdade. Como as notificações já estão gravadas no banco principal antes do evento, nenhuma se perde: no máximo chega atrasada.

> 💡 **Cleanup em React.** Todo `socket.on(...)` dentro de `useEffect` precisa de `socket.off(...)` no retorno. Sem isso, os listeners se acumulam a cada render, e cada mensagem aparece duplicada (e há vazamento de memória).

Estudo: [Socket.IO v4](https://socket.io/docs/v4/) (rooms, acknowledgements, connection state recovery) · [MDN: WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) · [Fastify](https://fastify.dev/docs/latest/)

## 7. Backlog inicial (sementes para issues)

**M0**
- [ ] Serviço `realtime` a partir do template; Socket.IO no servidor do Fastify
- [ ] Auth no handshake (repasse do cookie para o `web`)
- [ ] Provider de socket no `web` (conecta só logado, instância única, banner de reconexão)
- [ ] Prova de conceito: sala `user:<id>` + evento de teste

**M1**
- [ ] Amizades: `Friendship` no schema, Server Actions, página `/amigos`, `friendship.changed`
- [ ] Presença com várias abas + tolerância + envio só para amigos
- [ ] Chat: banco `realtime`, `chat:send` com ack e idempotência, `chat:message`, histórico paginado, lista de conversas, `/mensagens`

**M2**
- [ ] Helper `notify()` no `web` (grava `Notification` + publica `notification.created`) e `POST /api/internal/notifications`
- [ ] Entrega `notification:new` pelo `realtime`
- [ ] Listar e marcar como lida (uma e todas) + sino + `/notificacoes` + toasts
- [ ] Notificações das ações desta frente (amizade, mensagem)
- [ ] Feed de comunidade ao vivo (`community:*`)
- [ ] `sync:since` na reconexão
- [ ] Indicador de digitação + confirmação de leitura
- [ ] Métricas: `realtime_connected_clients`, `chat_messages_total`, `notifications_delivered_total`

**M3**
- [ ] Conferir a matriz linha a linha com todas as frentes
- [ ] Teste com 3+ navegadores, queda e volta do `realtime`, rede instável
- [ ] Teste Playwright com dois contextos de navegador conversando

## 8. Riscos específicos

- **Escopo das notificações** (R7): a matriz deve ser cobrada em toda PR.
- **Console:** socket conectando sem login; listeners duplicados; erro ao derrubar o serviço (o banner deve tratar sem `console.error` da nossa parte).
- **StrictMode** em dev: efeito duplo cria duas conexões. Use uma instância de módulo, não uma por componente.
- **Ordem das mensagens:** ordene pelo `createdAt` do **servidor**, não do cliente.
- **Entrega ao vivo perdida com o `realtime` fora:** o evento `notification.created` publicado enquanto o serviço reinicia se perde (pub/sub, [ADR-0005](../../adr/0005-comunicacao.md)), mas a notificação está no banco e aparece quando o cliente relê a lista do `web` (ao reconectar ou recarregar).

## 9. Como demonstrar

1. Alice (Chrome normal) e Bruno (anônimo): pedido de amizade → notificação em tempo real → aceitar → os dois se veem online.
2. Conversa ao vivo com indicador de digitação; recarregar → histórico intacto.
3. Bruno fecha uma de duas abas → continua online; fecha todas → offline para a Alice.
4. `docker compose restart realtime` → banner "reconectando…"; tentar enviar mostra erro amigável → o serviço volta sozinho → o cliente ressincroniza e o histórico está completo.
5. Percorrer a matriz de notificações (amostra) e mostrar o sino.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-17 | `Notification` no banco principal, gravada pelo `web`; o `realtime` só entrega | Modelo do schema atual; nenhuma notificação se perde se o `realtime` cair |

## 11. Estado atual

(2026-10-17) Nenhuma funcionalidade implementada. O modelo `Notification` (`message`, `isRead`, índice `(userId, isRead)`) existe no schema. `Friendship`, `Conversation` e `Message` não existem; o serviço `realtime` e o Redis também não.
