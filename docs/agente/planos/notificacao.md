# Plano: Sistema de notificações

- **Área / módulo(s):** Rafa / 13. Sistema completo de notificações
- **Status:** Rascunho
- **Última atualização:** 2026-11-04

## 1. Objetivo

O sistema de notificações deverá criar notificações, alertar, e criar um log das notificações recebidas. O usuário passa a ser notificado quando algum evento que o impacte, alem de poder ter um log das suas ultimas notificacoes, podendo controlar as lidas e nao lidas.

## 2. Estado atual verificado

O sistema inclui um icone na navbar que exibe a quantidade de notificacoes pendentes de leitura, e o link leva para uma tela onde todas as notificacoes sao exibidas.
Arquivos criados `notify.ts`, `notificacoes/page.tsx`, `notification/action.ts` (markAllAsRead + o botão de teste), `socket-provider.tsx`, `realtime-refresh.tsx`. O ícone de notificacao só aparece em / (o NavBar não está no layout).

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

- API: o notify() com a assinatura nova (type obrigatório, targetId opcional) e por que ele não é Server Action; o mapa de rotas como Record<NotificationType, ...>, que faz o build falhar se faltar a rota de um tipo; o markAsRead(id) com o dono no where; e quando o sendTestNotification sai.
- Tempo real: o contrato em uma linha. Evento notification, emitido pelo notify() para user:<id>, ouvido pelo RealtimeRefresh.
- UI: cada item vira link (quando houver) e mostra lidas e não lidas; dependência do layout da Juh para o sino em todas as páginas.

## 5. Impacto em outras pessoas

<!-- Interfaces de docs/TECNICO.md#interfaces-entre-pessoas que esta tarefa usa, cria ou muda. Quem precisa ser avisado? -->

| Pessoa | Impacto | Avisada? |
|---|---|---|
|Gabs|revisa a migration| |
|Juh|sino no layout (hoje só em /)| |
|Todos|`notify()` passa a exigir type; para tipo novo, a regra da linha 51| |

## 6. Passos



## 7. Como verificar

- Dois navegadores. 
- Na aba A, uma ação gera uma notificação. 
- Na aba B: o contador sobe, 
- Clicar leva ao link e a notificação aparece como lida. 
Caso de Falha:
- Teste também marcar como lida o id de uma notificação de outro usuário: tem de falhar. `make test`

## 8. Para eu explicar na avaliação

<!-- Conceitos que esta tarefa usa e que eu preciso saber explicar. Partes que vou escrever sem agente. -->

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| | |


