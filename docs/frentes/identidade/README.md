# F2: Identidade & Comunidades

> Última atualização: 2026-10-01 — escopo inicial.

| | |
|---|---|
| **Dono** | *a definir* |
| **Apoio** | *a definir* |
| **Módulos** | Gerenciamento padrão de usuários (2, com a F3), Upload de arquivos (1); parte obrigatória: cadastro e login seguros; produto: Comunidades |
| **Status** | ⬜ não iniciado |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Tudo o que diz respeito a **quem é o usuário e o que ele guarda**: cadastro, login, sessão, perfil, avatar, o sistema de arquivos e as comunidades. A autenticação está no **caminho crítico** do projeto: as outras frentes precisam de `requireUser()` nos primeiros dias.

## 2. Escopo

**Dentro:**
- **Auth (Better Auth, [ADR-0004](../../adr/0004-autenticacao.md)):** cadastro, login, logout; validação; rate limit de login; helpers `getSession()` e `requireUser()`; endpoints internos de sessão e de dados de usuário para o `realtime`.
- **Perfil:** página pública `/u/[username]` (dados, avatar, estatísticas que a F4 fornece, amigos que a F3 fornece); edição em `/config/perfil` (nome, username, bio, cidade, avatar).
- **Avatar padrão:** gerado (iniciais com cor derivada do ID) quando não há upload.
- **Sistema de arquivos ([ADR-0009](../../adr/0009-armazenamento-arquivos.md)):** API genérica de upload, download e exclusão usada por avatar, anexos de posts e GPX de trilhas realizadas (F4). Página `/config/arquivos`.
- **Comunidades:** criar, editar e excluir; pública ou privada; entrar, sair, solicitar entrada e aprovar; papéis (`owner`, `moderator`, `member`); posts (texto + anexos + trilha opcional); comentários; "minhas comunidades"; busca de comunidades com paginação.
- Publicação de eventos (`notification.requested`, `community.activity`, `user.profile.updated`) para cada ação, conforme a [matriz](../social/README.md#matriz-de-notificações).
- Seed de dev: usuários `alice`, `bruno`, `carla`, `diego`, `eva` com senha conhecida; seed de demo para a avaliação.

**Fora:** amizades e presença (F3); trilhas realizadas e estatísticas (F4); OAuth e 2FA (módulos reserva, só depois do M2).

## 3. Critérios de aceite

Os critérios dos módulos 4 e 9 estão em [MODULES.md](../../MODULES.md#4-gerenciamento-padrão-de-usuários-major). Além deles:
- [ ] Cadastro com e-mail, username e senha (mínimo de 8 caracteres), validado no front e no back; e-mail e username únicos com erro amigável.
- [ ] Senha nunca aparece em log nem em resposta; sessão em cookie `HttpOnly` e `Secure`.
- [ ] Rotas protegidas redirecionam para `/entrar` (página) ou respondem 401 (API) **sem gerar erro no console** no fluxo normal.
- [ ] Comunidade privada: não-membros veem só nome, descrição e o botão "solicitar entrada". Posts, membros e anexos ficam bloqueados **no servidor**.
- [ ] Toda ação CRUD desta frente publica a notificação prevista na matriz.

## 4. Desenho

### Dados (banco `web`)

Arquivos Prisma desta frente: `auth.prisma` (gerado ou estendido a partir do Better Auth), `files.prisma`, `communities.prisma`.

| Modelo | Campos principais | Observações |
|---|---|---|
| User | id, email (único), username (único), name, bio, city, avatarFileId?, createdAt | + tabelas do Better Auth (Session, Account, Verification) |
| File | id, ownerId, kind (`avatar`/`post_attachment`/`gpx`/`document`), mime, sizeBytes, originalName, storageKey, visibility (`public`/`private`/`community`), communityId?, createdAt | `storageKey` = UUID no disco |
| Community | id, slug (único), name, description, visibility (`public`/`private`), ownerId, coverFileId?, createdAt, updatedAt | |
| Membership | communityId, userId, role (`owner`/`moderator`/`member`), status (`active`/`pending`), createdAt | PK composta (communityId, userId) |
| Post | id, communityId, authorId, body, trailId?, createdAt, updatedAt | `trailId` é referência ao serviço `trails` (sem FK) |
| PostAttachment | postId, fileId | |
| Comment | id, postId, authorId, body, createdAt, updatedAt | |

### API e ações (no `web`)

| Ação | Tipo | Quem pode |
|---|---|---|
| Cadastro, login, logout | Better Auth | Qualquer um |
| Atualizar perfil | Server Action | O próprio usuário |
| `POST /api/files` (multipart) | Route Handler (precisa de XHR para o progresso) | Logado; limites por `kind` |
| `GET /api/files/:id` | Route Handler | Conforme `visibility` e associação à comunidade |
| `DELETE /api/files/:id` | Route Handler | Dono |
| CRUD de comunidade, membros, posts, comentários | Server Actions | Conforme o papel (tabela abaixo) |
| Endpoints `/api/internal/users/*` | Route Handler interno | Só serviços (`x-internal-token`) |

Permissões em comunidades:

| Ação | owner | moderator | member | não-membro (pública) | não-membro (privada) |
|---|---|---|---|---|---|
| Ver posts e membros | ✔ | ✔ | ✔ | ✔ | ✘ |
| Postar e comentar | ✔ | ✔ | ✔ | ✘ (precisa entrar) | ✘ |
| Editar ou excluir o próprio post ou comentário | ✔ | ✔ | ✔ | — | — |
| Excluir post de outro | ✔ | ✔ | ✘ | — | — |
| Aprovar entrada | ✔ | ✔ | ✘ | — | — |
| Promover a moderador, remover membro | ✔ | ✘ | ✘ | — | — |
| Editar ou excluir a comunidade | ✔ | ✘ | ✘ | — | — |

### Upload: limites e validação

| kind | Tipos aceitos | Tamanho máximo | Processamento | Preview |
|---|---|---|---|---|
| avatar | JPEG, PNG, WebP | 5 MB | Reencodar para WebP 256×256, remover EXIF | Imagem |
| post_attachment | JPEG, PNG, WebP, PDF, GPX | 10 MB | Imagens: reencodar + miniatura, remover EXIF | Imagem, PDF (visualizador do navegador), GPX (trilha num mini-mapa) |
| gpx | GPX | 5 MB | Validar XML e o namespace GPX; extrair a geometria | Mapa |

O tipo é detectado pelo **conteúdo** (magic bytes) com uma biblioteca como `file-type`. A extensão e o `Content-Type` enviados pelo navegador não são confiáveis.

## 5. Dependências

| Fornece para | O quê | Quando |
|---|---|---|
| **Todas** | `getSession()`, `requireUser()`, seed de usuários | **Sprint 0, dias 1–3 (caminho crítico)** |
| F3 | Endpoints internos de sessão e de usuários; `Friendship` vive no banco `web` (o schema é da F3) | M0–M1 |
| F4 | API de upload para GPX | M2 |
| F1 | Layout para a `/status` | M2 |

| Consome de | O quê | Enquanto não estiver pronto |
|---|---|---|
| F1 | Infra, layout base | — |
| F3 | Notificações (publicar evento) | Publique assim mesmo (pub/sub sem assinante não faz nada) |
| F4 | Estatísticas do perfil, cards de trilha nos posts | Placeholder "em breve" atrás de feature flag |

## 6. Conceitos-chave

> 💡 **Hash de senha com salt.** Nunca guardamos a senha, só um hash feito com um algoritmo **lento de propósito** (scrypt, bcrypt, argon2), para dificultar ataques de força bruta. O **salt** é um valor aleatório por usuário, misturado à senha antes do hash: duas pessoas com a mesma senha têm hashes diferentes, e tabelas pré-computadas (rainbow tables) não servem.

> 💡 **Sessão em cookie.** Depois do login, o servidor cria uma sessão no banco e manda um cookie com o identificador. `HttpOnly` impede que JavaScript leia o cookie (protege contra XSS), `Secure` só envia por HTTPS e `SameSite=Lax` não envia em requisições de outros sites (ajuda contra CSRF). Logout apaga a sessão no banco.

> 💡 **Autorização no servidor.** Esconder um botão não é segurança. Toda Server Action e Route Handler precisa checar "este usuário pode fazer isso com este recurso?". Um padrão útil é uma função `assertCanX(user, resource)` por tipo de ação, que é fácil de testar.

> 💡 **Upload seguro.** Valide pelo conteúdo, limite o tamanho, salve com nome aleatório fora da pasta pública, sirva por uma rota que checa permissão, use `X-Content-Type-Options: nosniff` e remova metadados EXIF (fotos de celular costumam carregar as coordenadas GPS de onde foram tiradas).

> 💡 **Server Actions.** Funções que rodam no servidor e são chamadas direto de formulários e componentes. O Next.js cuida da serialização e da proteção básica de origem. Mesmo assim, valide a entrada com zod e cheque a autorização dentro da action.

Estudo: [Better Auth](https://www.better-auth.com/docs) · [Next.js: Server Actions e Route Handlers](https://nextjs.org/docs) · [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) · [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## 7. Backlog inicial (sementes para issues)

**M0**
- [ ] Better Auth + Prisma: cadastro, login, logout (e-mail e senha)
- [ ] `getSession()` / `requireUser()` + proteção de rotas
- [ ] Páginas `/cadastro` e `/entrar` com validação no front e no back
- [ ] Seed de usuários de dev

**M1**
- [ ] Modelo `File` + `POST/GET/DELETE /api/files` (imagens) + armazenamento no volume
- [ ] Avatar: upload com progresso + avatar padrão gerado
- [ ] Perfil público `/u/[username]` + edição `/config/perfil`
- [ ] Endpoints internos para o `realtime` (sessão, `users/batch`)
- [ ] Privacidade e Termos v1 (conteúdo com o PO)

**M2**
- [ ] Upload completo: PDF, GPX, previews, página "Meus arquivos", exclusão, controle de acesso
- [ ] Comunidades: CRUD + visibilidade + papéis
- [ ] Entrar, sair, solicitar e aprovar entrada
- [ ] Posts (com anexos) + comentários
- [ ] Busca de comunidades (nome, visibilidade, paginação)
- [ ] Eventos de notificação de todas as ações desta frente

**M3**
- [ ] Testes de autorização (comunidade privada, arquivos)
- [ ] Testes de upload malicioso (extensão falsa, tamanho, SVG com script)
- [ ] Seed de demo para a avaliação

## 8. Riscos específicos

- **Atraso na auth bloqueia todo mundo:** priorize; entregue a assinatura de `requireUser()` primeiro.
- **API do Better Auth muda entre versões:** consulte a doc da versão instalada.
- **Vazamento em comunidade privada:** cada query de post, membro ou anexo precisa do filtro de permissão; escreva testes.
- **Body size:** ajuste o limite no nginx (e nas Server Actions, se usar upload por action).

## 9. Como demonstrar

1. Cadastro com erro de validação (front) → corrigir → erro do back (e-mail já usado) → sucesso.
2. Editar o perfil; enviar um avatar grande e ver a barra de progresso; ver o avatar padrão num usuário novo.
3. Enviar um `.exe` renomeado para `.png` → recusado pelo servidor.
4. Criar uma comunidade privada; o outro usuário solicita entrada; aprovar; postar com anexo PDF; o não-membro tenta abrir a URL do anexo → 403.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| | | |

## 11. Estado atual

Nada implementado ainda.
