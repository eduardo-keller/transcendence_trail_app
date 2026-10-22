# Plano: servidor de WebSocket (Socket.IO) dentro do Next.js

- **Área / módulo(s):** Gabs (infra) + Rafa (5. Tempo real, notificações). Ver [MODULOS.md](../../MODULOS.md#rafa--social-e-tempo-real)
- **Status:** Rascunho
- **Última atualização:** 2026-10-22

## 1. Objetivo

Um **servidor customizado** (`apps/web/server.mjs`) sobe o Next.js e o Socket.IO no mesmo processo e na mesma porta. Ao final, o Gabs entrega ao Rafa:
- conexão Socket.IO funcionando por `wss://localhost:8443/socket.io/`, em `make` e em `make dev` (com o hot reload intacto);
- só usuário logado conecta (o mesmo cookie do Better Auth);
- cada usuário entra automaticamente numa sala `user:<id>`;
- um jeito de emitir eventos a partir do código do Next (Server Actions, Route Handlers): `getIO()`.

A partir daí, o Rafa escreve `notify()`, presença e chat sem mexer em Docker, nginx ou `server.mjs`.

## 2. Estado atual verificado

| O quê | Situação | Onde |
|---|---|---|
| Next.js | 16.4.2. A doc instalada (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md`) mantém o servidor customizado: `next({ dev, httpServer })` + `app.getRequestHandler()`. O arquivo **não passa pelo compilador do Next**: tem de ser JavaScript que o Node 24 roda direto. Não combina com `output: 'standalone'` (não usamos) | `apps/web/package.json` |
| Como o container inicia | `npm run dev` (alvo `dev`) e `npm start` (alvo `prod`). Mudando só os scripts do `package.json`, o **Dockerfile não muda** | [Dockerfile](../../../docker/nextjs/Dockerfile) |
| nginx | Já repassa `Upgrade`/`Connection` em `location /`, com `proxy_read_timeout 1h` e `proxy_buffering off` | [nginx.conf.template](../../../docker/nginx/conf/nginx.conf.template) |
| Hot reload | Usa um WebSocket próprio do Next (`/_next/webpack-hmr`) na mesma porta: o Socket.IO não pode derrubar esse upgrade | — |
| Sessão | `auth.api.getSession({ headers })` em `src/lib/auth.ts` (TypeScript com alias `@/`, que o `server.mjs` não consegue importar) | [session.ts](../../../apps/web/src/server/auth/session.ts) |
| Socket.IO | Não instalado. **Dependência nova: precisa de aprovação** (`socket.io` no servidor, `socket.io-client` no navegador) | `package.json` |
| Código de tempo real | Nenhum (`src/server/` não tem `realtime/`) | — |

## 3. Critérios de aceite

- [ ] `make` e `make dev` sobem normalmente; `test-all.sh` continua passando nos dois modos
- [ ] Em `make dev`, o hot reload continua funcionando com o Socket.IO ligado
- [ ] Um cliente com o cookie de sessão conecta e entra na sala `user:<id>`; sem cookie (ou com cookie forjado) recebe `connect_error`
- [ ] Uma Server Action de teste chama `getIO().to('user:<id>').emit(...)` e o navegador logado recebe
- [ ] Conexão pelo nginx em `wss://` (DevTools → Network → WS mostra `101 Switching Protocols`)
- [ ] Sem erros ou warnings no console do Chrome

## 4. Desenho

**`apps/web/server.mjs`** (Gabs; ~40 linhas):
1. cria o `http.Server`, `next({ dev, httpServer })` e repassa toda requisição ao `handle` do Next;
2. cria o `Server` do Socket.IO no mesmo `http.Server`, com `path: '/socket.io/'` e `destroyUpgrade: false` (senão o Socket.IO fecha os upgrades que não são dele, inclusive o do hot reload);
3. middleware de conexão: repassa o cabeçalho `cookie` do handshake para `http://127.0.0.1:3000/api/auth/get-session`. Sessão válida → `socket.data.user`; senão, `next(new Error('unauthorized'))`. Assim o `server.mjs` usa o Better Auth sem importar código TypeScript;
4. na conexão, `socket.join('user:' + id)`;
5. guarda a instância em `globalThis.io`.

**`apps/web/src/server/realtime/io.ts`** (Gabs; ~5 linhas): `getIO()` lê `globalThis.io` com o tipo do Socket.IO e lança erro claro se não existir (ex.: nos testes do Vitest, que não sobem servidor).

**`package.json`**: `"dev": "node server.mjs"`, `"start": "node server.mjs"` (em produção o `NODE_ENV=production` já vem do Dockerfile).

**Fica com o Rafa:** `notify()` (grava `Notification` e emite para `user:<id>`), presença online/offline, chat, o hook do cliente com `socket.io-client`, reconexão.

**Tempo real (contrato inicial, o Rafa pode mudar):**

| Evento | Quem emite | Quem escuta |
|---|---|---|
| `notification` | servidor (`notify()`) | o usuário da sala `user:<id>` |
| demais (presença, chat) | definidos pelo Rafa | — |

## 5. Impacto em outras pessoas

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Rafa | Recebe a infraestrutura pronta e o `getIO()`; escreve o resto. Combinar o contrato da seção 4 | [ ] |
| Todos | `npm run dev`/`start` passam a rodar `server.mjs` (transparente para quem usa `make`) | [ ] |
| Juh | Nenhum, salvo o hook do cliente se ela fizer a UI das notificações | [ ] |

## 6. Passos

- [ ] 1. **Pedir aprovação** para instalar `socket.io` e `socket.io-client` (versões fixas, conferidas no npm na hora)
- [ ] 2. `server.mjs` sem Socket.IO, só o Next: trocar os scripts, conferir `make`, `make dev` (hot reload) e `test-all.sh`. Commit separado: isola qualquer problema do servidor customizado
- [ ] 3. Socket.IO + middleware de sessão + sala `user:<id>` + `globalThis.io`; `src/server/realtime/io.ts`
- [ ] 4. Verificação (seção 7), inclusive o hot reload com o Socket.IO ligado
- [ ] 5. `test-all.sh`: handshake do Socket.IO pelo nginx responde; conexão sem cookie é recusada
- [ ] 6. Docs: TECNICO (interfaces: `getIO()`, sala `user:<id>`, evento `notification`), decisoes (já tomada), README (Technical Stack: Socket.IO "Em uso")

## 7. Como verificar

```bash
make dev
curl -sk "https://localhost:8443/socket.io/?EIO=4&transport=polling"   # 0{"sid":...}: o Socket.IO responde pelo nginx
```

No Chrome logado: no console, `io()` (página de teste temporária com `socket.io-client`) conecta; DevTools → Network → WS mostra `/socket.io/` com 101. Disparar a Server Action de teste e ver o evento chegar. Em aba anônima, a conexão falha com `unauthorized`. Editar um arquivo e ver o hot reload funcionar.

## 8. Para eu explicar na avaliação

- Por que o WebSocket não cabe num Route Handler (a resposta HTTP termina; o socket fica aberto) e por que o servidor customizado resolve.
- Upgrade HTTP → WebSocket passando pelo nginx (`Upgrade`/`Connection`), e por que o `destroyUpgrade: false` protege o hot reload.
- Autenticação do socket: o handshake carrega o cookie; o servidor confere a sessão no Better Auth.
- Salas do Socket.IO: `user:<id>` permite mandar para uma pessoa em qualquer aba ou aparelho.
- Por que `globalThis.io`: o Next e o Socket.IO rodam no mesmo processo.

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-22 | Decidido (Gabs): servidor customizado em vez de container separado. Menos peças para o Gabs (sem serviço novo, sem mudança no nginx nem no Dockerfile) e para o Rafa (`notify()` emite direto, sem comunicação entre containers) |
