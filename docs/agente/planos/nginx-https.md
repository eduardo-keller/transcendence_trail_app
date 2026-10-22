# Plano: nginx + HTTPS (e ajustes rápidos dos módulos 2 e 3)

- **Área / módulo(s):** Gabs / requisito obrigatório "HTTPS em todo o backend" ([AVALIACAO.md](../../AVALIACAO.md)); módulos 2 e 3 ([MODULOS.md](../../MODULOS.md#gabs--backend-e-banco))
- **Status:** Em execução
- **Última atualização:** 2026-10-22

Duas partes: **A** são ajustes de doc e comentário (~30 min, um PR); **B** é o nginx (um PR, revisão obrigatória por mexer no Docker).

## 1. Objetivo

- `make` sobe um container `nginx` que é o **único** com porta publicada: HTTPS na 8443 e HTTP na 8080 só redirecionando.
- O app inteiro (páginas, `/api/*`, login, hot reload do `next dev`) funciona em `https://localhost:8443`, sem erro no console além do aviso do certificado.
- O certificado é um arquivo trocável: autoassinado gerado no start se não existir; se a decisão com a Juh for mkcert, basta colocar os arquivos na pasta.
- README e docs refletem o backend e o schema reais.

## 2. Estado atual verificado

| O quê | Situação | Onde |
|---|---|---|
| Portas publicadas | `nextjs` em `3000:3000`; `prisma-studio` em `5555:5556`, em todas as interfaces | [docker-compose.yml](../../../docker/docker-compose.yml) |
| Prisma Studio | **Divergência:** não tem `profiles: [tools]`, então sobe em todo `make up`. O Makefile, o TECNICO.md e o `test-all.sh` supõem o profile | compose, [Makefile](../../../Makefile) (`studio`, `clean`) |
| Volumes anônimos do `nextjs` | Apontam para `/apps/...` em vez de `/app/...` (já é aviso no `test-all.sh`) | compose. **Fora deste plano**: muda onde fica o `node_modules` de todos |
| Imagens | Alpine 3.24.2 próprias, com `tini` como PID 1 | `docker/nextjs/`, `docker/postgres/` |
| Better Auth | Lê `BETTER_AUTH_URL` do ambiente; hoje `http://localhost:3000` | [auth.ts](../../../apps/web/src/lib/auth.ts), [.env.example](../../../docker/.env.example) |
| Testes de ponta a ponta | Fixos em `http://localhost:3000`; `test-all.sh` exige "nextjs publica a porta 3000" e Studio em `:5555`; já tem um aviso esperando HTTPS em 443 ou 8443 | [tests/](../../../tests/) (`test-auth.sh` é do Diego) |
| `.gitignore` | Caminhos do plano antigo: `infra/nginx/certs/`, `services/trails/...`, `services/ai/...` | [.gitignore](../../../.gitignore) |
| README, diagrama | `User ||--o{ Trail`, mas `Trail.authorId` é opcional (trilhas do OSM) → deveria ser `User |o--o{ Trail` | [README.md](../../../README.md#database-schema) |
| README, Technical Stack | "Tailwind instalado, ainda não configurado": desatualizado desde `35e83fd` (Rafa) | README |
| README, módulo 2 | Coluna "Justificativa e implementação" vazia; caixa "README explica o que é backend no Next.js" aberta | README, MODULOS |
| Comentários | Apontam para `docs/frentes/trilhas/README.md#api`, que não existe mais | [route.ts:7](../../../apps/web/src/app/api/trails/route.ts#L7), [schemas.ts:4](../../../apps/web/src/server/trails/schemas.ts#L4) |

## 3. Critérios de aceite

- [ ] `docker ps` (sem `make studio`): só o `nginx` tem porta publicada (8443 e 8080)
- [ ] `http://localhost:8080/qualquer/coisa` → 301 para `https://localhost:8443/qualquer/coisa`
- [ ] `https://localhost:8443/api/health` responde com `"db":`; cadastro, login e `/conta` funcionam pelo navegador
- [ ] Hot reload continua funcionando (WebSocket do `next dev` passa pelo nginx)
- [ ] Server Action (ex.: criar trilha) funciona pelo HTTPS, sem erro de origem
- [ ] Apagar `docker/nginx/certs/` e rodar `make` gera um certificado novo; colocar outro `.crt`/`.key` lá faz o nginx usá-lo
- [ ] `make studio` sobe o Studio só em `127.0.0.1:5555`; `make up` não sobe o Studio
- [ ] `make test`, `tests/test-all.sh`, `test-auth.sh` e `test-trails.sh` passam
- [ ] Sem erros ou warnings no console do Chrome (fora o aviso do certificado autoassinado)

## 4. Desenho

**Decisões tomadas neste plano** (mudam fácil depois):

| Decisão | Por quê |
|---|---|
| Portas **8443** (HTTPS) e **8080** (HTTP) no host, configuráveis por `HTTPS_PORT`/`HTTP_PORT` | 443 e 80 podem estar ocupadas ou exigir root (Docker rootless nas máquinas da 42). O `test-all.sh` já aceita 443 ou 8443 |
| Imagem própria `alpine:3.24.2` + `apk add nginx openssl`, com `tini` | Segue a decisão "imagens Alpine próprias" e o padrão dos outros dois containers |
| Certificado em `docker/nginx/certs/` (bind mount, no `.gitignore`), gerado pelo entrypoint com `openssl` se faltar | Trocar por mkcert vira "colocar dois arquivos"; funciona até com `docker compose up` direto, sem o Makefile |
| Studio com `profiles: [tools]` e porta `127.0.0.1:5555` | Não sobe no `make` padrão (versão de avaliação) e, quando sobe, só a própria máquina acessa. Não passa pelo nginx: ele abre o banco sem senha |

**Arquivos novos**

- `docker/nginx/Dockerfile`: Alpine + nginx + openssl + tini; `EXPOSE 443 80`.
- `docker/nginx/tools/entrypoint.sh`: gera `server.crt`/`server.key` (RSA 2048, 365 dias, `subjectAltName=DNS:localhost,IP:127.0.0.1`) se não existirem; preenche a porta pública no config com `envsubst` (vem do pacote `gettext`) ou `sed`; `exec nginx -g 'daemon off;'`.
- `docker/nginx/conf/default.conf`:
  - `server :80` → `return 301 https://$host:${HTTPS_PORT}$request_uri;` (a porta pública precisa entrar no redirect, porque o nginx só conhece a 443 de dentro do container);
  - `server :443 ssl` com TLS 1.2/1.3, `proxy_pass http://nextjs:3000`, `proxy_http_version 1.1`, `Upgrade`/`Connection` (para HMR e o futuro WebSocket), `Host $http_host`, `X-Forwarded-Proto https`, `X-Forwarded-For`;
  - cabeçalho `Strict-Transport-Security` **sem** `includeSubDomains` e com `max-age` curto, para não "prender" o `localhost` do avaliador em HTTPS para outros projetos.

**Arquivos alterados**

- `docker-compose.yml`: serviço `nginx` (`depends_on: nextjs`, portas `${HTTP_PORT:-8080}:80` e `${HTTPS_PORT:-8443}:443`, volume `./nginx/certs:/etc/nginx/certs`); tirar `ports` do `nextjs` (passa a usar só a rede interna); Studio com profile e `127.0.0.1`.
- `docker/.env.example`: `BETTER_AUTH_URL=https://localhost:8443`, `HTTPS_PORT=8443`, `HTTP_PORT=8080`. Quem já tem `docker/.env` precisa atualizar à mão (o Makefile não sobrescreve). Avisar no PR.
- `.gitignore`: trocar `infra/nginx/certs/` por `docker/nginx/certs/`; apagar `services/trails/...` e `services/ai/...`.
- `tests/*.sh`: URL base por variável (`APP=${APP:-https://localhost:8443}`), `curl -k`, `Origin` igual à URL nova; no `test-all.sh`, trocar "nextjs publica 3000" por "só o nginx publica porta" e transformar o aviso de HTTPS em `check`.

**Riscos a conferir na hora** (não dá para saber sem rodar)

- `next dev` atrás de proxy: o Next 16 pode bloquear requisições de dev de outra origem (`allowedDevOrigins` no `next.config.ts`). Como o host continua `localhost`, provavelmente não precisa. Conferir no console.
- Better Auth com `https` passa a usar o cookie `__Secure-...`: os scripts de teste que leem o cookie pelo nome podem precisar de ajuste.
- Server Actions comparam `Origin` com `Host`/`X-Forwarded-Host`: por isso o `Host $http_host` (que inclui a porta).

## 5. Impacto em outras pessoas

| Pessoa | Impacto | Avisada? |
|---|---|---|
| Todos | Endereço muda para `https://localhost:8443`; atualizar `docker/.env` à mão (ou apagar e deixar o `make` copiar) | [ ] |
| Juh | Destrava o teste do service worker. A escolha do certificado (autoassinado × mkcert) continua pendente com ela | [ ] |
| Di | O Gabs ajusta o `test-auth.sh` (URL, `-k`, cookie) depois do nginx pronto; OAuth vai precisar da URL https como callback | [ ] |
| Rafa | O proxy já repassa `Upgrade`, mas a rota do WebSocket depende da decisão pendente | [ ] |
| Edu | Diagrama `arquitetura` precisa ganhar o nginx; a skill de excalidraw só existe na máquina dele | [ ] |

## 6. Passos

**Parte A: um PR, sem Docker**
- [ ] A1. Corrigir os dois comentários para apontar para [TECNICO.md#interfaces-entre-pessoas](../../TECNICO.md#interfaces-entre-pessoas)
- [ ] A2. README, Modules: preencher a linha do backend (Route Handlers para `GET` públicos, Server Actions para formulários, helpers em `src/server/api/`, regras em `src/server/<área>/service.ts`); marcar a caixa em MODULOS
- [ ] A3. README, Database Schema: `User |o--o{ Trail`; conferir o resto do diagrama contra o schema (o resto bate hoje)
- [ ] A4. README, Technical Stack: Tailwind "Em uso" (correção óbvia; registrar no PR)
- [ ] A5. `make npm args="run lint"`

**Parte B: nginx**
- [ ] B1. `docker/nginx/` (Dockerfile, entrypoint, conf) e `.gitignore`
- [ ] B2. Compose: serviço `nginx`, tirar a porta do `nextjs`, Studio com profile e `127.0.0.1`
- [ ] B3. `.env.example` e o próprio `docker/.env`
- [ ] B4. Subir e conferir os critérios da seção 3 no navegador
- [ ] B5. Só depois do B4 funcionando: ajustar os três scripts de `tests/`, incluindo o `test-auth.sh` do Diego (só URL, `-k`, `Origin` e nome do cookie; a lógica dos testes não muda; avisar no PR); rodar `make test` e `bash tests/test-all.sh`
- [ ] B6. Docs: README (Instructions: URL, portas, comando `make studio`; Technical Stack: nginx "Em uso"), TECNICO.md (linhas 10 e 82), AVALIACAO.md (caixa do HTTPS), [decisoes/](../../decisoes/README.md) (portas 8443/8080 em "Tomadas"; certificado continua pendente)
- [ ] B7. Pedir ao Edu a atualização do diagrama `arquitetura`

## 7. Como verificar

```bash
make && docker ps --format '{{.Names}} {{.Ports}}'        # só o nginx com porta
curl -sI http://localhost:8080/trilhas | grep -i location  # https://localhost:8443/trilhas
curl -sk https://localhost:8443/api/health                 # {"status":"ok","db":...}
openssl s_client -connect localhost:8443 </dev/null 2>/dev/null | grep -E 'subject|Protocol'
make test && bash tests/test-all.sh
```

No Chrome: abrir `https://localhost:8443`, aceitar o certificado, cadastrar, logar, abrir `/conta`, editar um arquivo em `apps/web/src` e ver o hot reload. Console sem erros.

## 8. Para eu explicar na avaliação

- O que é proxy reverso e por que só o nginx expõe porta (o `nextjs` e o `postgres` ficam só na rede interna do Compose).
- Terminação TLS: o HTTPS acaba no nginx; dentro da rede do Docker é HTTP. O `X-Forwarded-Proto` diz ao app que o cliente usou HTTPS.
- Por que o redirect usa `$host:${HTTPS_PORT}` e não só `$host`.
- O que o `Upgrade`/`Connection` faz (WebSocket do HMR e, depois, do tempo real).
- Autoassinado × CA local (mkcert) e por que isso importa para o service worker do PWA.

## 9. Registro

| Data | O que aconteceu / decidimos |
|---|---|
| 2026-10-22 | Plano criado. Portas 8443/8080 e certificado gerado no entrypoint propostos aqui |
| 2026-10-22 | Aprovado com dois acréscimos: `make up` avisa `.env` desatualizado (`check-env`); `BETTER_AUTH_URL` sai do `.env` e é montado no compose a partir da `HTTPS_PORT` (um valor antigo esquecido no `.env` é ignorado) |
| 2026-10-22 | Mudanças na implementação: o certificado é gerado pelo **Makefile** (como os segredos), não pelo entrypoint, para os arquivos ficarem com o usuário do host e não com root; o entrypoint só falha com mensagem clara se faltar. **Sem HSTS**: vale para o `localhost` em qualquer porta e prenderia outros projetos do avaliador em HTTPS. `X-Forwarded-For` sobrescrito com `$remote_addr`, para ninguém burlar o rate limit forjando o IP |
| 2026-10-22 | Partes A e B commitadas localmente. **Falta B4** (subir e conferir no navegador): o Docker não estava rodando na máquina |
