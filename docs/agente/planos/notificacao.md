# Plano: Sistema de notificações

- **Área / módulo(s):** Rafa / 13. Sistema completo de notificações
- **Status:** Rascunho
- **Última atualização:** 2026-11-04

## 1. Objetivo

O sistema de notificações deverá criar notificações, alertar, e criar um log das notificações recebidas. O usuário passa a ser notificado quando algum evento que o impacte, alem de poder ter um log das suas ultimas notificacoes, podendo controlar as lidas e nao lidas.

## 2. Estado atual verificado

Feito (até `de9e5dd`):
- Schema: `enum NotificationType` + `type` e `targetId` em `Notification` (`d0aa45f`).
- `src/server/realtime/notify.ts`: `notify({ userId, message, type, targetId? })` grava e emite `notification` para `user:<id>`.
- `src/server/notification/routes.ts`: mapa `Record<NotificationType, Route>` + `notificationHref()` e `usernameTargetIds()`, com teste em `tests/unit/notification-routes.test.ts`.
- `src/server/notification/action.ts`: `markAllAsRead` e `sendTestNotification` (temporário).
- `src/app/notificacoes/page.tsx`: lista as 50 últimas e destaca as não lidas.
- `SocketProvider` (no `layout.tsx`, só com sessão) + `RealtimeRefresh`, que chama `router.refresh()` ao receber `notification`.
- `NavBar` + `NotificationBell` com o contador.

Falta:
- A página não usa o `routes.ts`: os itens ainda não são links.
- Não dá para marcar **uma** notificação como lida.
- O `NavBar` só aparece em `/` (não está no layout).
- Ao reconectar, nada é recarregado: notificação que chegou com o socket caído só aparece no próximo F5.
- Nenhuma ação real chama `notify()`; só o botão de teste.
- Sem teste de integração do `notify()` nem das actions.
- A exportação GDPR (`src/server/gdpr/export.ts`) não inclui `type` nem `targetId`.

## 3. Critérios de aceite

- [ ] Sem erros ou warnings no console
- [ ] 📜 Notificações para **todas** as ações de criação, atualização e exclusão
- [ ] Helper `notify()` que grava em `Notification` e entrega em tempo real
- [ ] Sino com contador de não lidas, página de notificações, marcar como lida (uma e todas)
- [ ] Todas as linhas da [lista de ações](../../MODULOS.md#ações-que-geram-notificação) conferidas com dois usuários

## 4. Desenho

**Dados**

Dois campos novos em `Notification`, numa migration só (`make migrate name=notification_type_target`), sem editar o SQL:

| Campo | Tipo | Obrigatório | Default | Por quê |
|---|---|---|---|---|
| `type` | `enum NotificationType` | sim | `GENERAL` | O banco recusa valor fora da lista; o default preenche as linhas que já existem |
| `targetId` | `String?` | não | — | Sobre quem ou o quê é a notificação; o link é montado no código a partir de `type` + `targetId` |

Valores iniciais do enum (`userId` = para quem é; `targetId` = sobre quem ou o quê):

| Tipo | Quem recebe | `targetId` | Leva para |
|---|---|---|---|
| `FRIEND_REQUEST` | o destinatário | quem pediu | perfil de quem pediu |
| `FRIEND_ACCEPTED` | quem pediu | quem aceitou | perfil de quem aceitou |
| `FRIEND_DECLINED` | quem pediu | quem recusou | sem link |
| `FRIEND_REMOVED` | quem desfez | o ex-amigo | sem link |
| `MESSAGE` | o destinatário | a conversa (a confirmar no plano do chat) | a conversa |
| `GENERAL` | — | — | sem link |

Decisões:
- **`enum`, não `String`:** o banco valida. Custo aceito: tipo novo = migration revisada pelo Gabs.
- **`targetId`, não `link`:** sem URL guardada, open redirect é impossível, e uma rota pode mudar de nome sem quebrar as notificações antigas.
- **`targetId` sem chave estrangeira:** ele aponta para tabelas diferentes conforme o `type`. Alvo apagado: a página de destino responde `notFound()` (404).
- **Pessoas por `userId`, não por `username`:** o username pode ser editado. A página `/notificacoes` busca os usernames numa consulta só (`where: { id: { in: [...] } }`).
- **Os tipos das outras áreas ficam com cada dono:** cada um acrescenta, no próprio PR, o valor no enum + a rota no mapa de rotas + a migration. Até lá, usa `GENERAL`. Acrescentar valor a um enum é barato; renomear ou remover é caro, então não vale adivinhar os tipos dos outros.
- **Fora deste plano:** tipos de comunidade (adiada, [PLANO.md](../../PLANO.md)).

**API / Server Actions**

| Função | Onde | Quem chama | O que faz |
|---|---|---|---|
| `notify({ userId, message, type, targetId? })` | `src/server/realtime/notify.ts` | o código do servidor, depois que a ação deu certo | grava e emite. **Não** é Server Action: se fosse, qualquer cliente poderia criar notificação para qualquer usuário |
| `openNotification(id)` | `src/server/notification/action.ts` | o clique num item | `updateMany({ where: { id, userId: user.id } })` marca como lida; monta o link com `notificationHref()` e faz `redirect()`. Sem link: só marca |
| `markAllAsRead()` | idem | botão da página | já existe |
| `sendTestNotification()` | idem | botão de teste | **sai** no passo 6, quando a primeira ação real estiver ligada |

- `userId` no `where` (em vez de `update({ where: { id } })`): o id de uma notificação de outro usuário não acha nada e não altera nada. Sem 404 diferente, para não revelar se o id existe.
- O link é calculado no servidor a partir de `type` + `targetId`, nunca vem do cliente: o `redirect()` não vira open redirect.
- `Record<NotificationType, Route>`: um tipo novo sem rota quebra o `tsc`/build, então ninguém esquece.

**Tempo real**

| Evento | Quem emite | Sala | Quem escuta | Efeito |
|---|---|---|---|---|
| `notification` | `notify()` | `user:<id>` | `RealtimeRefresh` | `router.refresh()`: o contador e a página se atualizam |
| `connect` (reconexão) | Socket.IO | — | `RealtimeRefresh` | `router.refresh()` |

O banco é a fonte da verdade e o socket só avisa "algo mudou". Por isso a reconexão não precisa reenviar nada: um refresh busca tudo que chegou com o socket caído.

**UI**

- `/notificacoes`: cada item vira um `<form action={openNotification.bind(null, n.id)}>` com botão. Item com link leva ao destino; sem link, só marca como lida. Lida e não lida com estilo diferente (já existe). Estado vazio já existe.
- A página busca os usernames numa consulta só (`usernameTargetIds()` → `findMany({ where: { id: { in } } })`) e passa o `Map` para `notificationHref()`.
- Sino em todas as páginas: o `NavBar` precisa ir para o layout (área da Juh, ver seção 5).
- Fora deste plano: o toast para quem fez a ação ("Regra proposta" em MODULOS.md). Decidir com a Juh, que tem o design system.

## 5. Impacto em outras pessoas

<!-- Interfaces de docs/TECNICO.md#interfaces-entre-pessoas que esta tarefa usa, cria ou muda. Quem precisa ser avisado? -->

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Gabs | Revisa a migration (já mergeada em `d0aa45f`) | [ ] |
| Juh | `NavBar` (com o sino) no layout para aparecer em todas as páginas; toast para quem fez a ação | [ ] |
| Di | Chamar `notify()` nas ações dela (lista em MODULOS.md); acrescentar `type` e `targetId` na exportação GDPR | [ ] |
| Edu | Chamar `notify()` em XP, nível e emblema | [ ] |
| Gabs | Chamar `notify()` em trilhas, atividades, importação e exportação | [ ] |
| Todos | `notify()` exige `type`; tipo novo = valor no enum + rota em `routes.ts` + migration, no mesmo PR (ver seção 4) | [ ] |

## 6. Passos

- [ ] 1. Teste de integração (`tests/integration/notifications.test.ts`): `notify()` grava com o `type` certo; `openNotification` marca a própria; o id de outro usuário não muda nada; `markAllAsRead` só mexe nas do próprio usuário
- [ ] 2. `openNotification(id)` em `action.ts`
- [ ] 3. Página `/notificacoes`: usernames numa consulta, cada item vira form com `openNotification`
- [ ] 4. `RealtimeRefresh`: ouvir também `connect` e chamar `router.refresh()`
- [ ] 5. Combinar com a Juh o `NavBar` no layout (ou ela mesma faz)
- [ ] 6. Ligar `notify()` nas ações do Rafa à medida que a amizade e o chat ficam prontos (plano próprio); tirar o `sendTestNotification` quando a primeira ação real funcionar
- [ ] 7. Avisar cada dono das linhas dele na [lista de ações](../../MODULOS.md#ações-que-geram-notificação) e acompanhar até todas estarem marcadas
- [ ] 8. Verificação (seção 7) + `make npm args="run lint"` + `make test`
- [ ] 9. Docs: caixas do módulo 13 em MODULOS.md, interfaces em TECNICO.md, README (Modules)

Os passos 1 a 5 são independentes da amizade e do chat e podem ir num PR só. Os passos 6 e 7 fecham o módulo e dependem dos outros.



## 7. Como verificar

- Dois navegadores. 
- Na aba A, uma ação gera uma notificação. 
- Na aba B: o contador sobe, 
- Clicar leva ao link e a notificação aparece como lida. 
Caso de Falha:
- Teste também marcar como lida o id de uma notificação de outro usuário: tem de falhar. `make test`

## 8. Para eu explicar na avaliação

- Por que o `notify()` não é Server Action, e por que o `userId` vai no `where` do `openNotification`.
- Por que guardar `type` + `targetId` em vez de uma URL (open redirect, rotas renomeadas).
- O fluxo de ponta a ponta: ação → `notify()` → banco → `getIO().to('user:<id>')` → `RealtimeRefresh` → `router.refresh()` → Server Component lê o banco de novo.
- Por que a reconexão não perde nada (o banco é a fonte da verdade).
- Sugestão: escrever você mesmo o `openNotification` e a mudança no `RealtimeRefresh`, que são as partes mais prováveis de serem pedidas ao vivo.

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-11-04 | Plano completado com o que falta (seções 2, 4, 5, 6, 8) |


