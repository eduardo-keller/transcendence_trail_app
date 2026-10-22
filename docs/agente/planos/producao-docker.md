# Plano: modo produção no container do app

- **Área / módulo(s):** Gabs / Docker e Makefile; requisito eliminatório "console sem erros nem warnings" ([AVALIACAO.md](../../AVALIACAO.md)); módulo 3 ([MODULOS.md](../../MODULOS.md#gabs--backend-e-banco))
- **Status:** Concluído
- **Última atualização:** 2026-10-22

## 1. Objetivo

- `make` (o que o avaliador roda) sobe o app **em modo produção**: `next build` na imagem e `next start` no container. Sai o código de desenvolvimento (HMR, overlay de erros, avisos extras do React), que pode sujar o console.
- `make dev` sobe o modo de hoje, com hot reload, para o dia a dia do time.
- De quebra: as duas linhas mortas de volume saem do compose, o `X-Powered-By` some e a caixa do schema é marcada no módulo 3.

**Fora deste plano** (boa prática, não pesa na avaliação): usuário sem root no container e tirar o `node_modules` do disco do host.

## 2. Estado atual verificado

| O quê | Situação | Onde |
|---|---|---|
| Comando do container | Sempre `npm run dev` (`next dev`) | [Dockerfile](../../../docker/nextjs/Dockerfile) |
| Imagem | Um estágio: Alpine 3.24.2 + Node; `npm ci` na imagem; o código vem do bind mount `../apps/web:/app` | idem, [docker-compose.yml](../../../docker/docker-compose.yml) |
| Volumes `/apps/node_modules` e `/apps/.next` | Caminho errado (`/apps`, não `/app`): não fazem nada. O `node_modules` usado é o do bind mount, no seu disco (com dono root) | compose |
| Build de produção | Já passa: o `test-all.sh` roda `next build` num container descartável com `DATABASE_URL` e `BETTER_AUTH_SECRET` falsos | `tests/test-all.sh`, passo 12 |
| `prisma` (CLI) | Está em `dependencies`: o `migrate deploy` do entrypoint funciona na imagem de produção | [package.json](../../../apps/web/package.json) |
| Importação no start | Precisa de `prisma/data/` dentro do container | `apps/web/prisma/` |
| `X-Powered-By: Next.js` | Em toda resposta (aviso no `test-all.sh`) | — |
| Módulo 3 | Caixa "Schema com relações claras e diagrama no README" aberta; o diagrama foi corrigido em `2c55f5f` | MODULOS.md |

## 3. Critérios de aceite

- [ ] Clone limpo → `make` → `https://localhost:8443` em modo produção: sem `hmr-client` no HTML; console de `/`, `/login`, `/conta` e `/profile` sem nada além do que o próprio app escreve
- [ ] `make dev` volta ao hot reload (editar um arquivo atualiza a página pelo nginx)
- [ ] Alternar `make` ↔ `make dev` funciona sem `make fclean` (o banco continua)
- [ ] `make npm` e `make migrate` em produção param com "rode make dev antes"
- [ ] `make test`, `make import-trails` e `make sh` funcionam nos dois modos
- [ ] Respostas sem `X-Powered-By`
- [ ] `bash tests/test-all.sh` passa nos dois modos

## 4. Desenho

**Dockerfile do `nextjs` com dois alvos** (um arquivo):

```
dev    alpine + node; npm ci; entrypoint; CMD npm run dev     (código pelo bind mount, como hoje)
prod   = dev + COPY apps/web + prisma generate + next build; NODE_ENV=production; CMD npm start
```

O `next build` precisa de `DATABASE_URL` e `BETTER_AUTH_SECRET` só para carregar os módulos. Os valores falsos vão **na própria linha do `RUN`**, não em `ENV`, para não ficarem gravados na imagem. É o mesmo truque do `test-all.sh`.

**Entrypoint:** igual ao de hoje. Em produção, o `npm ci` já não roda, porque o lock da imagem bate. O `prisma generate` roda de novo, sem efeito, e custa uns segundos. Não vale um `if`.

**Compose**
- `docker-compose.yml` (base = produção): `nextjs` com `build.target: prod`, **sem** bind mount e sem as duas linhas mortas.
- `docker-compose.dev.yml` (novo, só acrescenta): `nextjs` com `target: dev`, `APP_MODE=dev`, `WATCHPACK_POLLING` e o bind mount `../apps/web:/app`. O `prisma-studio` fica no alvo `dev`.
- Os dois usam o mesmo nome de projeto, então `make` e `make dev` trocam o mesmo container. O `exec` dos outros alvos funciona nos dois modos.

**Makefile**

| Alvo | O que faz |
|---|---|
| `make` / `make up` | produção. A primeira vez demora ~2 min a mais (`next build`); depois, só o que mudou |
| `make dev` | **novo**: `docker compose -f base -f dev up -d --build` |
| `make npm`, `make migrate` | param com "rode make dev antes" se não houver `APP_MODE=dev` no container: eles precisam gravar no seu disco (`package-lock.json`, migrations) |

**nginx:** `proxy_hide_header X-Powered-By;` (uma linha na área do Gabs; o `next.config.ts` é compartilhado).

## 5. Impacto em outras pessoas

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Todos | **`make` vira produção**: editar código não atualiza mais a página. Para programar, `make dev` | [ ] |
| Todos | Na avaliação, para mudar código ao vivo: editar e rodar `make` (1–2 min); mostra o app como ele é entregue | [ ] |
| Juh | O PWA deve ser testado no `make` (o service worker não funciona direito no `next dev`) | [ ] |
| Edu | `make npm args="install ..."` só no `make dev` | [ ] |

## 6. Passos

- [ ] 1. Dockerfile com os alvos `dev` e `prod`; compose base em produção sem as linhas mortas; `docker-compose.dev.yml`. Commit `feat(docker)`
- [ ] 2. Makefile: `dev` e a guarda em `npm`/`migrate`. Commit `feat(make)`
- [ ] 3. nginx sem `X-Powered-By`. Commit `fix(docker)`
- [ ] 4. Subir em produção e em dev; conferir a seção 3 (Chrome headless + seus testes manuais)
- [ ] 5. `test-all.sh`: "modo produção" e "X-Powered-By" viram checagens; o aviso dos volumes `/apps` sai (as linhas não existem mais); `make -n` inclui `dev`. Rodar nos dois modos. Commit `test(tests)`
- [ ] 6. Docs: README (`make` × `make dev`, tabela de comandos, como mudar código na avaliação), TECNICO (Rodar o projeto), MODULOS (caixa do schema), registro deste plano. Commit `docs(docs)`

## 7. Como verificar

```bash
make && curl -sk https://localhost:8443/ | grep -c hmr-client      # 0
curl -skI https://localhost:8443/ | grep -i x-powered-by            # nada
make npm args="ls"                                                  # para: "rode make dev antes"
make dev && curl -sk https://localhost:8443/ | grep -c hmr-client   # 1 ou mais
bash tests/test-all.sh                                              # depois de make e depois de make dev
```

À mão: em produção, o console de `/` fica vazio. Em dev, editar `profile/page.tsx` atualiza a página.

## 8. Para eu explicar na avaliação

- `next dev` × `next build` + `next start`: o que o build faz (compila, otimiza, separa páginas estáticas das dinâmicas) e por que o dev gera avisos que a produção não gera.
- Build em estágios: um Dockerfile, dois alvos; em produção o código entra na imagem, em dev chega por bind mount.
- Override de compose (`-f base -f dev`): o segundo arquivo só acrescenta ou troca campos.
- Por que mudar código ao vivo exige `make` de novo: a imagem guarda o código compilado.

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-22 | Plano criado numa versão maior (usuário sem root, `node_modules` em volume, `make deps`) e enxugado: só o que pesa na avaliação. Na avaliação, mudança ao vivo = editar + `make` |
| 2026-10-22 | Implementado. Diferenças: o entrypoint roda `npm ci` e `prisma generate` só com `APP_MODE=dev` (em produção o `npm ci` rodaria se o lock parecesse mais novo); o Prisma Studio também recebe `APP_MODE=dev`; o `.dockerignore` passou a ignorar `apps/web/.next` (o padrão `.next` só valia na raiz); o build descartável do `test-all.sh` usa `npm ci --include=dev`, porque a imagem de produção tem `NODE_ENV=production` |
| 2026-10-22 | `test-all.sh`: 338 ok em produção e 335 ok em `make dev`, 0 falhas. Chrome headless em produção: console vazio em `/` e `/profile`; em `/login` sobra só a sugestão "[DOM] Input elements should have autocomplete attributes" (nível verbose, tela da Di/Rafa) |
