# F1: Plataforma & Observabilidade

> Última atualização: 2026-10-01 — escopo inicial.

| | |
|---|---|
| **Dono** | *a definir* (sugestão: Tech Lead) |
| **Apoio** | *a definir* |
| **Módulos** | Microsserviços (2), Monitoramento Prometheus/Grafana (2), Health/Status/Backups (1); configura Frameworks e ORM |
| **Status** | ⬜ não iniciado |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Ser o **chão** sobre o qual as outras frentes constroem: o repositório, os containers, a rede, o HTTPS, o template de serviço, a CI e a observabilidade. No Sprint 0 esta frente está no caminho crítico. Depois disso, entrega três módulos de DevOps.

## 2. Escopo

**Dentro:**
- Monorepo pnpm, configs compartilhadas (TypeScript, ESLint, Prettier, Vitest).
- `packages/service-kit`: base Fastify (logger pino, tratamento de erros no formato padrão, validação zod, `/health`, `/ready`, `/metrics`, verificação de `x-internal-token`, propagação de `x-request-id`, encerramento gracioso).
- Template de serviço (uma pasta para copiar) usado por F3, F4 e F5.
- `compose.yaml`, Dockerfiles multi-stage, `Makefile`, `.env.example`, geração de segredos.
- nginx: TLS autoassinado gerado automaticamente, 80 → 443, roteamento, upgrade de WebSocket, SSE sem buffer, headers de segurança, `client_max_body_size`, bloqueio de `/api/internal/*` e `/api/metrics`.
- Postgres (imagem com PostGIS + pgvector), script de init (bancos, usuários, extensões); Redis.
- CI no GitHub Actions: lint, typecheck, testes, build das imagens.
- Prometheus + exporters, Grafana (provisionado), Alertmanager, regras de alerta.
- Status page `/status` (página no `web`, junto com a F2 para o layout).
- Backups, restauração, runbook de recuperação de desastre.
- Guia de setup (`docs/guides/setup.md`) e a seção "Comandos" do AGENTS.md.

**Fora:** lógica de negócio dos serviços; métricas de negócio específicas (cada frente adiciona as suas usando o `service-kit`).

## 3. Critérios de aceite

Os critérios dos módulos 7, 13 e 14 estão em [MODULES.md](../../MODULES.md#7-backend-em-microsserviços-major). Da parte obrigatória, esta frente garante:
- [ ] `make` sobe tudo numa máquina limpa (só com Docker e Make instalados, mais o `.env`).
- [ ] HTTPS em tudo; só o nginx publica portas.
- [ ] `.env` ignorado e `.env.example` completo.

## 4. Desenho

### Containers (`compose.yaml`)

| Container | Imagem | Rede | Volume | Observação |
|---|---|---|---|---|
| nginx | nginx | public + internal | certs | Única porta publicada (8443, 8080 → redirect) |
| web | build `apps/web` | internal | uploads | `depends_on` postgres, redis |
| realtime, trails, ai | build `services/*` | internal | ai: cache do modelo | |
| postgres | build `infra/postgres` (postgis + pgvector) | internal | pgdata | init cria 4 bancos e 4 usuários |
| redis | redis | internal | — | |
| prometheus | prom/prometheus | internal | prometheus-data | retenção de 7 dias |
| alertmanager | prom/alertmanager | internal | — | webhook do Discord via `.env` |
| grafana | grafana/grafana | internal | grafana-data | `/grafana/` via nginx; sem anônimo |
| node-exporter, cadvisor, postgres-exporter, redis-exporter, nginx-exporter | oficiais | internal | — | cAdvisor pode precisar de ajuste no WSL2 ou Docker Desktop |
| backup | build `infra/backup` | internal | backups, uploads (somente leitura) | cron com `pg_dump` |

Use um **profile** `observability` para poder desligar Prometheus, Grafana e exporters no dia a dia (economiza RAM). No `make` de avaliação, tudo sobe.

### Métricas padrão (`service-kit`)
- `http_requests_total{service,method,route,status}`
- `http_request_duration_seconds{service,method,route}` (histograma)
- Métricas padrão do processo Node (CPU, memória, event loop)
- Cada frente adiciona as suas (ex.: `realtime_connected_clients`, `ai_tokens_total`, `trails_search_duration_seconds`)

### Dashboards (provisionados em `infra/grafana/`)
1. **Serviços (RED):** taxa de requisições, erros e latência p50/p95 por serviço e rota.
2. **Infraestrutura:** CPU, memória e rede por container; disco; Postgres (conexões, tamanho dos bancos); Redis.
3. **Produto:** usuários conectados, mensagens por minuto, notificações enviadas, requisições e tokens de IA, rate limit atingido, buscas.

### Alertas (regras no Prometheus → Alertmanager → `#alertas`)
| Alerta | Condição (ideia) |
|---|---|
| `ServiceDown` | `up == 0` por 1 min |
| `HighErrorRate` | 5xx > 5% em 5 min |
| `HighLatency` | p95 > 1 s em 5 min |
| `PostgresDown` / `RedisDown` | exporter reporta indisponível |
| `BackupStale` | último backup bem-sucedido há mais de 2× o intervalo |
| `ContainerHighMemory` | > 90% do limite |

### Health, status e backups
- `/health`: o processo responde (liveness). `/ready`: banco, Redis e dependências essenciais ok (readiness).
- O healthcheck do compose usa `/ready`; os serviços dependentes esperam `service_healthy`.
- `/status` (público): o servidor consulta o `/ready` de cada serviço, mede a latência e mostra o horário do último backup. Os estados são operacional, degradado e fora.
- **Backup:** a cada `BACKUP_INTERVAL` (padrão de 6 h; reduzir na demo), `pg_dump -Fc` de cada banco + `tar` do volume de uploads → `backups/<timestamp>/` com checksum; retenção `BACKUP_KEEP` (ex.: 14). Grava uma métrica com o timestamp do último sucesso (para o alerta e a status page).
- **Restauração:** `make restore TS=<timestamp>` para os apps, roda `pg_restore --clean` em cada banco, restaura os uploads e sobe tudo de novo.
- **Runbook** (`docs/runbooks/disaster-recovery.md`): cenários (banco corrompido, volume perdido, máquina perdida), passo a passo, **RPO** (≤ intervalo de backup) e **RTO** (meta de 15 min), e um registro dos testes de restauração.

## 5. Dependências

| Fornece para | O quê | Quando |
|---|---|---|
| Todas | compose + Postgres + Redis + nginx com TLS | Sprint 0, dias 1–2 |
| F3, F4, F5 | `service-kit` + template de serviço | Sprint 0, dias 2–3 |
| Todas | CI | Sprint 0 |
| Todas | `/metrics` e `/health` automáticos | junto com o `service-kit` |

| Consome de | O quê |
|---|---|
| F2 | Layout do `web` para a página `/status` |
| Todas | Endpoints `/metrics` e `/ready` funcionando nos serviços |

## 6. Conceitos-chave

> 💡 **Imagem × container × compose.** A imagem é o "molde" imutável (construída pelo Dockerfile). O container é a imagem rodando. O compose descreve vários containers, suas redes e volumes num arquivo só. **Multi-stage build:** um estágio compila (com as ferramentas de build) e outro só roda (imagem menor e mais segura).

> 💡 **Proxy reverso e terminação TLS.** O nginx recebe HTTPS do navegador, decifra e repassa HTTP para os serviços na rede interna. Assim, só um lugar lida com certificados. O certificado autoassinado gera aviso no navegador porque nenhuma autoridade confiável o assinou: a criptografia funciona igual.

> 💡 **Modelo pull do Prometheus.** O Prometheus **busca** (scrape) as métricas em `/metrics` de cada alvo, a cada N segundos. **Exporters** traduzem sistemas que não falam Prometheus (Postgres, Redis, o host) para esse formato. PromQL é a linguagem de consulta: `rate(http_requests_total[5m])`.

> 💡 **RED e USE.** Para serviços, observe **R**ate, **E**rrors e **D**uration. Para recursos (CPU, disco), observe **U**tilization, **S**aturation e **E**rrors. Os dashboards seguem essas duas lentes.

> 💡 **Liveness × readiness.** Liveness responde "o processo está vivo?" (se não, reinicia). Readiness responde "consegue atender agora?" (se não, ainda não recebe tráfego, por exemplo enquanto o banco sobe).

> 💡 **RPO e RTO.** RPO é quanto dado você aceita perder (o intervalo entre backups). RTO é quanto tempo leva para voltar ao ar. Um backup que nunca foi restaurado não é backup: teste.

Estudo: [Docker Compose](https://docs.docker.com/compose/) · [Prometheus](https://prometheus.io/docs/introduction/overview/) · [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) · [nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)

## 7. Backlog inicial (sementes para issues)

**M0 (Sprint 0)**
- [ ] Monorepo pnpm + configs (TS, ESLint, Prettier, Vitest)
- [ ] `infra/postgres` (imagem + init com 4 bancos, 4 usuários e extensões)
- [ ] `compose.yaml` base (postgres, redis, nginx, web, serviços) + redes + volumes
- [ ] nginx: TLS autoassinado automático, rotas, WebSocket, SSE, headers, bloqueios
- [ ] `packages/service-kit` + template de serviço
- [ ] `Makefile` (`make`, `make down`, `make logs`, `make dev-infra`, `make clean`) + geração do `.env`
- [ ] CI (lint, typecheck, testes)
- [ ] Guia de setup + seção "Comandos" do AGENTS.md
- [ ] Medir o consumo de RAM com tudo de pé

**M1**
- [ ] Prometheus + exporters + scrape de todos os serviços
- [ ] Dashboard 1 (Serviços RED)
- [ ] Healthchecks e `depends_on` no compose
- [ ] CI constrói as imagens Docker

**M2**
- [ ] Alertmanager + regras + webhook do Discord
- [ ] Grafana via `/grafana/` com login; dashboards 2 e 3
- [ ] Container de backup + retenção + métrica de último backup
- [ ] `make restore` + runbook de DR
- [ ] Status page `/status`

**M3**
- [ ] Teste de restauração registrado no runbook
- [ ] Teste Playwright de console limpo na CI (junto com o Tech Lead)
- [ ] Teste completo em máquina limpa

## 8. Riscos específicos

- Build Docker do Next.js em monorepo (`standalone` + `outputFileTracingRoot`).
- cAdvisor no WSL2/Docker Desktop (pode exigir montagens diferentes ou ficar parcial: documente a limitação).
- Grafana em subcaminho (`GF_SERVER_ROOT_URL` + `serve_from_sub_path`).
- SSE bufferizado pelo nginx (`proxy_buffering off` ou header `X-Accel-Buffering: no`).
- Scripts de init do Postgres só rodam na **primeira** criação do volume.

## 9. Como demonstrar

1. `make` em clone limpo → `docker compose ps` com tudo `healthy`.
2. Arquitetura: diagrama + um banco e um usuário por serviço (`\l` e `\du` no psql).
3. Grafana: os três dashboards com tráfego real.
4. `docker compose stop ai` → app funcionando, status page "degradado", alerta `ServiceDown` disparando e chegando no Discord.
5. Backup manual → apagar dado de teste → `make restore` → dado de volta.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| | | |

## 11. Estado atual

Nada implementado ainda.
