# F2: Identidade & Comunidades

> Última atualização: 2026-10-17 — rotas do Better Auth (`/api/auth/*`), rate limit e cliente de auth.

| | |
|---|---|
| **Dono** | *a definir* |
| **Apoio** | *a definir* |
| **Módulos** | Gerenciamento padrão de usuários (2, com a F3), Upload de arquivos (1); parte obrigatória: cadastro e login seguros; produto: Comunidades e eventos |
| **Status** | 🟡 em andamento |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Tudo o que diz respeito a **quem é o usuário e o que ele guarda**: cadastro, login, sessão, perfil, avatar, o sistema de arquivos, as comunidades e seus eventos. A autenticação está no **caminho crítico** do projeto: as outras frentes precisam de `requireUser()` nos primeiros dias.

## 2. Escopo

**Dentro:**
- **Auth (Better Auth, [ADR-0004](../../adr/0004-autenticacao.md)):** cadastro, login, logout; validação; rate limit de login; helpers `getSession()` e `requireUser()`; endpoints internos de sessão e de dados de usuário para o `realtime`.
- **Perfil:** página pública `/u/[id]` (dados, avatar, estatísticas e emblemas que a F4 fornece, amigos que a F3 fornece); edição em `/config/perfil`.
- **Avatar padrão:** gerado (iniciais com cor derivada do ID) quando `User.image` está vazio.
- **Sistema de arquivos ([ADR-0009](../../adr/0009-armazenamento-arquivos.md)):** API genérica de upload, download e exclusão usada por avatar, mídia de posts e GPX (trilhas e atividades da F4). Página `/config/arquivos`.
- **Comunidades:** criar, editar e excluir; entrar e sair; papéis `ADMIN`/`MODERATOR`/`MEMBER`; posts com mídia; comentários; "minhas comunidades"; busca de comunidades com paginação. Comunidades privadas (visibilidade + entrada por solicitação) quando os campos forem criados.
- **Eventos de comunidade:** criar, editar e excluir saídas; participar e desistir.
- Notificações de cada ação, conforme a [matriz](../social/README.md#matriz-de-notificações).
- Seed de dev: usuários `alice`, `bruno`, `carla`, `diego`, `eva` com senha conhecida; seed de demo para a avaliação.

**Fora:** amizades e presença (F3); trilhas, atividades e emblemas (F4); OAuth e 2FA (módulos reserva, só depois do M2).

## 3. Critérios de aceite

Os critérios dos módulos 4 e 9 estão em [MODULES.md](../../MODULES.md#4-gerenciamento-padrão-de-usuários-major). Além deles:
- [ ] Cadastro com nome, e-mail e senha (mínimo de 8 caracteres), validado no front e no back; e-mail único com erro amigável.
- [ ] Senha nunca aparece em log nem em resposta; sessão em cookie `HttpOnly` (e `Secure` com HTTPS).
- [ ] Rotas protegidas redirecionam para `/login` (página) ou respondem 401 (API) **sem gerar erro no console** no fluxo normal.
- [ ] Só `ADMIN` edita ou exclui a comunidade e muda papéis; checado **no servidor**.
- [ ] Toda ação CRUD desta frente gera a notificação prevista na matriz.

## 4. Desenho

### Dados (banco principal, `apps/web/prisma/schema.prisma`, seções `better-auth core` e `social`)

**Existe:**

| Modelo | Campos | Observações |
|---|---|---|
| User | id, name, email (único), emailVerified, image?, createdAt, updatedAt | Formato do Better Auth. `image` guarda a URL do avatar |
| Session, Account, Verification | Formato do Better Auth | A senha (hash) fica em `Account.password`; `Session.token` único |
| Community | id, name (único), description?, image?, createdAt | |
| CommunityMember | id, role (`ADMIN`/`MODERATOR`/`MEMBER`, padrão `MEMBER`), userId, communityId | `UNIQUE(userId, communityId)` |
| Event | id, title, description, date, communityId, organizerId | Saída organizada por uma comunidade |
| EventParticipant | id, eventId, userId | `UNIQUE(eventId, userId)` |
| Post | id, content, mediaUrl?, createdAt, userId, communityId? | Sem `communityId` = post no perfil |

**A criar (com migration, quando a funcionalidade chegar):**

| Modelo / campo | Para quê |
|---|---|
| `User.username`, `User.bio`, `User.city` | Perfil completo (Better Auth aceita campos extras via `additionalFields`) |
| `File` (ownerId, kind, mime, sizeBytes, originalName, storageKey, visibility, createdAt) | Sistema de arquivos; `User.image` e `Post.mediaUrl` passam a apontar para `/api/files/:id` |
| `Comment` (postId, authorId, content, createdAt, updatedAt) | Comentários |
| `Community.visibility`, `CommunityMember.status` (`ACTIVE`/`PENDING`) | Comunidades privadas com entrada por solicitação |
| `Post.updatedAt` | Saber se um post foi editado |

### API e ações (no `web`)

| Ação | Tipo | Quem pode |
|---|---|---|
| Cadastro, login, logout | Better Auth (`app/api/auth/[...all]/route.ts`) | Qualquer um |
| Atualizar perfil | Server Action | O próprio usuário |
| `POST /api/files` (multipart) | Route Handler (precisa de XHR para o progresso) | Logado; limites por `kind` |
| `GET /api/files/:id` | Route Handler | Conforme `visibility` e associação à comunidade |
| `DELETE /api/files/:id` | Route Handler | Dono |
| CRUD de comunidade, membros, posts, comentários, eventos | Server Actions | Conforme o papel (tabela abaixo) |
| Endpoints `/api/internal/users/*` | Route Handler interno | Só serviços (`x-internal-token`) |

Permissões em comunidades:

| Ação | ADMIN | MODERATOR | MEMBER | não-membro |
|---|---|---|---|---|
| Ver posts, membros e eventos | ✔ | ✔ | ✔ | ✔ (✘ se a comunidade for privada, quando existir) |
| Postar, comentar, participar de evento | ✔ | ✔ | ✔ | ✘ (precisa entrar) |
| Editar ou excluir o próprio post ou comentário | ✔ | ✔ | ✔ | — |
| Excluir post de outro | ✔ | ✔ | ✘ | — |
| Criar, editar ou excluir evento | ✔ | ✔ | ✘ (o organizador edita o próprio) | — |
| Mudar papéis, remover membro | ✔ | ✘ | ✘ | — |
| Editar ou excluir a comunidade | ✔ | ✘ | ✘ | — |

### Upload: limites e validação

| kind | Tipos aceitos | Tamanho máximo | Processamento | Preview |
|---|---|---|---|---|
| avatar | JPEG, PNG, WebP | 5 MB | Reencodar para WebP 256×256, remover EXIF | Imagem |
| post_media | JPEG, PNG, WebP, PDF | 10 MB | Imagens: reencodar + miniatura, remover EXIF | Imagem, PDF (visualizador do navegador) |
| gpx | GPX | 5 MB | Validar XML e o namespace GPX; converter para GeoJSON (F4) | Mapa |

O tipo é detectado pelo **conteúdo** (magic bytes) com uma biblioteca como `file-type`. A extensão e o `Content-Type` enviados pelo navegador não são confiáveis.

## 5. Dependências

| Fornece para | O quê | Quando |
|---|---|---|
| **Todas** | `getSession()`, `requireUser()`, seed de usuários | **Sprint 0, dias 1–3 (caminho crítico)** |
| F3 | Endpoints internos de sessão e de usuários; `Friendship` vive no banco principal (o schema é da F3) | M0–M1 |
| F4 | API de upload para GPX | M2 |
| F1 | Layout para a `/status` | M2 |

| Consome de | O quê | Enquanto não estiver pronto |
|---|---|---|
| F1 | Infra, layout base | — |
| F3 | Entrega de notificações em tempo real | Gravar a `Notification` assim mesmo |
| F4 | Estatísticas e emblemas do perfil | Placeholder "em breve" atrás de feature flag |

## 6. Conceitos-chave

> 💡 **Hash de senha com salt.** Nunca guardamos a senha, só um hash feito com um algoritmo **lento de propósito** (scrypt, bcrypt, argon2), para dificultar ataques de força bruta. O **salt** é um valor aleatório por usuário, misturado à senha antes do hash: duas pessoas com a mesma senha têm hashes diferentes, e tabelas pré-computadas (rainbow tables) não servem. No Better Auth, o hash fica em `Account.password`.

> 💡 **Sessão em cookie.** Depois do login, o servidor cria uma sessão no banco (`Session`) e manda um cookie com o token. `HttpOnly` impede que JavaScript leia o cookie (protege contra XSS), `Secure` só envia por HTTPS e `SameSite=Lax` não envia em requisições de outros sites (ajuda contra CSRF). Logout apaga a sessão no banco.

> 💡 **Autorização no servidor.** Esconder um botão não é segurança. Toda Server Action e Route Handler precisa checar "este usuário pode fazer isso com este recurso?". Um padrão útil é uma função `assertCanX(user, resource)` por tipo de ação, que é fácil de testar.

> 💡 **Upload seguro.** Valide pelo conteúdo, limite o tamanho, salve com nome aleatório fora da pasta pública, sirva por uma rota que checa permissão, use `X-Content-Type-Options: nosniff` e remova metadados EXIF (fotos de celular costumam carregar as coordenadas GPS de onde foram tiradas).

> 💡 **Server Actions.** Funções que rodam no servidor e são chamadas direto de formulários e componentes (como a action `login` de `src/app/login/page.tsx`). O Next.js cuida da serialização e da proteção básica de origem. Mesmo assim, valide a entrada com zod e cheque a autorização dentro da action.

Estudo: [Better Auth](https://www.better-auth.com/docs) · [Next.js: Server Actions e Route Handlers](https://nextjs.org/docs) · [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) · [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## 7. Backlog inicial (sementes para issues)

**M0**
- [x] Better Auth + adapter Prisma + tabelas (`src/lib/auth.ts`, migration `better_auth_and_cleanup`)
- [x] Route Handler `app/api/auth/[...all]/route.ts` + cliente de auth + rate limit
- [ ] `/login` autenticando de verdade e `/cadastro`, com validação no front e no back
- [ ] `getSession()` / `requireUser()` + proteção de rotas
- [ ] Seed de usuários de dev

**M1**
- [ ] Modelo `File` + `POST/GET/DELETE /api/files` (imagens) + armazenamento no volume
- [ ] Avatar: upload com progresso + avatar padrão gerado
- [ ] Campos de perfil (`username`, `bio`, `city`) + perfil público `/u/[id]` + edição `/config/perfil`
- [ ] Endpoints internos para o `realtime` (sessão, `users/batch`)
- [ ] Privacidade e Termos v1 (conteúdo com o PO)

**M2**
- [ ] Upload completo: PDF, GPX, previews, página "Meus arquivos", exclusão, controle de acesso
- [ ] Comunidades: CRUD + papéis + entrar e sair
- [ ] Posts (com mídia) + `Comment`
- [ ] Eventos: CRUD + participar
- [ ] Busca de comunidades (nome, paginação)
- [ ] Comunidades privadas (`visibility`, `status` de membro), se o tempo permitir
- [ ] Notificações de todas as ações desta frente

**M3**
- [ ] Testes de autorização (papéis, arquivos)
- [ ] Testes de upload malicioso (extensão falsa, tamanho, SVG com script)
- [ ] Seed de demo para a avaliação

## 8. Riscos específicos

- **Atraso na auth bloqueia todo mundo:** priorize; entregue a assinatura de `requireUser()` primeiro.
- **API do Better Auth muda entre versões:** consulte a doc da versão instalada (1.7).
- **Vazamento entre comunidades:** cada query de post, membro, evento ou anexo precisa do filtro de permissão; escreva testes.
- **Body size:** ajuste o limite no nginx (e nas Server Actions, se usar upload por action).

## 9. Como demonstrar

1. Cadastro com erro de validação (front) → corrigir → erro do back (e-mail já usado) → sucesso → login.
2. Editar o perfil; enviar um avatar grande e ver a barra de progresso; ver o avatar padrão num usuário novo.
3. Enviar um `.exe` renomeado para `.png` → recusado pelo servidor.
4. Criar uma comunidade (vira `ADMIN`); outro usuário entra; promover a `MODERATOR`; criar um evento e o outro participa; postar com mídia; um `MEMBER` tenta excluir post alheio → recusado.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-17 | Papéis `ADMIN`/`MODERATOR`/`MEMBER` (enum `Role`), sem dono único | Modelo do schema atual |
| 2026-10-17 | Login em `/login` | Rota já criada no código |
| 2026-10-17 | Comunidades têm eventos (`Event`, `EventParticipant`) | Modelo do schema atual |
| 2026-10-17 | Rate limit ligado também em dev, em memória: 5/min no login e 3/min no cadastro (por IP); 100/min nas demais rotas de auth | O padrão do Better Auth só liga em produção, e o container roda `next dev`. Em memória não precisa de tabela, mas zera ao reiniciar. Com o nginx, configurar `advanced.ipAddress.trustedProxies` |

## 11. Estado atual

(2026-10-17)
- `apps/web/src/lib/auth.ts`: Better Auth com adapter Prisma, e-mail e senha (mínimo de 8 caracteres), rate limit e o plugin `nextCookies()`. O segredo vem do Docker secret `better_auth_secret`.
- `app/api/auth/[...all]/route.ts`: rotas do Better Auth (`/api/auth/sign-up/email`, `/sign-in/email`, `/sign-out`, `/get-session`...).
- `apps/web/src/lib/auth-client.ts`: cliente para componentes do navegador.
- Cookie de sessão `HttpOnly` e `SameSite=Lax`; sem `Secure` enquanto não houver HTTPS.
- Tabelas do Better Auth e de comunidades, eventos e posts criadas (migrations `20261017005754_init` e `20261017161143_better_auth_and_cleanup`).
- `/login`: formulário com uma Server Action que só confere os tipos dos campos; ainda não autentica.
- Faltam: `/cadastro`, `getSession()`/`requireUser()`, seed, perfil, arquivos e as telas de comunidades.
