*This project has been created as part of the 42 curriculum by <login_eduardo>, <login_ju>, <login_gabriel>, <login_diego>, <login_rafael>.*

<!--
README EXIGIDO PELO SUBJECT (capítulo VI) E AVALIADO.
- A primeira linha acima é obrigatória, em itálico e com esse texto exato. Troque os <login_*> pelos logins da 42.
- Este arquivo é um RASCUNHO VIVO: cada seção diz quem atualiza e quando.
- Checklist das seções obrigatórias: docs/AVALIACAO.md (seção README).
- Documentação interna do time: docs/README.md.
-->

# Trilhas SP *(nome provisório)*

## Description

**Trilhas SP** é uma plataforma de trilhas para São Paulo e cidades do entorno, inspirada no Wikiloc. O usuário encontra trilhas (catálogo inicial do OpenStreetMap), vê o percurso no mapa, registra as trilhas que fez, ganha XP e emblemas, conversa com amigos em tempo real e tira dúvidas com um assistente de IA que conhece as trilhas da região. O app pode ser instalado (PWA) e funciona offline para as trilhas já vistas.

**Funcionalidades principais:**
- Catálogo de trilhas do OpenStreetMap com mapa e página de detalhe (distância, desnível, dificuldade).
- Registro de atividades, XP e níveis, emblemas e ranking.
- Conta com e-mail e senha, login via OAuth, autenticação de dois fatores, perfil e avatar.
- Privacidade de dados (GDPR): baixar os próprios dados e excluir a conta, com e-mails de confirmação.
- Amigos com status online e chat 1:1 em tempo real.
- Notificações em tempo real para as ações do usuário.
- Assistente de IA: perguntas sobre trilhas com fontes (RAG) e planejador de trilha com streaming (LLM).
- PWA instalável com suporte offline e design system próprio.

<!-- Atualizado por: quem entregar a funcionalidade. Revisar a lista perto da avaliação. -->

## Instructions

<!-- Atualizado por: Gabs (Docker, nginx, Makefile). Fonte da verdade: Makefile e docker/. -->

### Pré-requisitos
- Docker com o plugin Docker Compose (`docker compose`) *(versões mínimas: a definir)*
- GNU Make e OpenSSL (o `make` gera os segredos com `openssl rand`)
- Navegador: Google Chrome (versão estável mais recente)

### Configuração
Nada é obrigatório na primeira vez: o `make` cria o que faltar.
- `docker/.env` é copiado de [`docker/.env.example`](docker/.env.example) (`POSTGRES_USER`, `POSTGRES_DB`, `HTTPS_PORT`, `HTTP_PORT`). Ele é copiado uma vez só: quando o `.env.example` muda, o `make` avisa o que falta ou sobra.
- `docker/secrets/db_password.txt` e `docker/secrets/better_auth_secret.txt` são gerados com valores aleatórios e entram nos containers como Docker secrets. **Não apague** esses arquivos com o banco já criado: a senha nova não abriria o banco existente.
- `data/postgres/` guarda os dados do Postgres (bind mount, fora do git).
- `docker/nginx/certs/` recebe um certificado autoassinado para `localhost` (fora do git). Para usar outro (ex.: mkcert), troque `server.crt` e `server.key`.

### Execução
```bash
make            # build + sobe postgres e nextjs (equivale a `make up`)
```
Acesse **https://localhost:8443** e aceite o aviso do certificado autoassinado. O nginx é o único container com porta publicada: `http://localhost:8080` só redireciona para o HTTPS. As portas mudam em `docker/.env` (`HTTPS_PORT`, `HTTP_PORT`).

No start, o container `nextjs` monta a `DATABASE_URL` a partir do secret, roda `npm ci` se o `package-lock.json` mudou, `prisma generate`, `prisma migrate deploy` e então `next dev` com hot reload (o código de `apps/web` é montado no container).

| Comando | O que faz |
|---|---|
| `make` / `make up` | Gera `.env`, segredos, certificado e `data/postgres` se faltarem; avisa se o `.env` está desatualizado; `docker compose up -d --build` |
| `make build` | Só constrói as imagens |
| `make stop` / `make down` | Para os containers / remove os containers |
| `make logs` | Segue os logs (deve mostrar o `migrate deploy` e o "Ready" do Next) |
| `make sh` | Shell no container `nextjs` |
| `make npm args="install zod"` | Roda `npm` dentro do container |
| `make migrate name=<descricao>` | `prisma migrate dev --name <descricao>` dentro do container |
| `make import-trails` | Reimporta as trilhas do OSM do SQLite (upsert; não duplica) |
| `make test` | Testes (Vitest) num banco separado, `<POSTGRES_DB>_test` |
| `bash tests/test-all.sh` | Bateria do projeto inteiro com o app no ar (~5 min; `--rapido` pula o build) |
| `make studio` | Prisma Studio em http://localhost:5555, só nesta máquina (profile `tools`; abre o banco sem senha) |
| `make clean` | Remove containers, imagens locais e volumes |
| `make fclean` | `clean` + apaga `data/postgres` (**apaga o banco**) |
| `make re` | `fclean` + `make` (sobe do zero) |

### Alterar o schema do banco
1. Edite [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma).
2. `make migrate name=<descricao>` (com os containers de pé).
3. Faça commit do schema **junto** com a pasta `apps/web/prisma/migrations/`.

Quem baixar a mudança só precisa de `make up`: as migrations pendentes rodam no start.

Antes de commitar, `git status` não deve listar nada de `docker/secrets/`, `docker/.env` ou `data/postgres/`.

*(a completar: e-mail em dev, quando existir)*

## Resources

### Referências
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Better Auth: https://www.better-auth.com/docs
- Socket.IO: https://socket.io/docs/v4/
- PostGIS: https://postgis.net/documentation/
- pgvector: https://github.com/pgvector/pgvector
- OpenStreetMap: https://wiki.openstreetmap.org/wiki/Map_features
- *(cada pessoa adiciona as referências que usou)*

### Uso de IA
<!--
OBRIGATÓRIO pelo subject: descrever como a IA foi usada, em quais tarefas e em quais partes do projeto.
Fonte: o campo "Uso de IA nesta PR" de cada PR. Consolidar perto da avaliação.
-->
*(a completar)*

## Team Information

<!-- Papéis exigidos pelo subject: PO, PM, Tech Lead, Developers. Áreas: docs/PLANO.md. -->

| Membro | Login | Papel(is) | Responsabilidades |
|---|---|---|---|
| Juh | `<login>` | *a definir* + Dev | Frontend e design system: páginas, componentes, PWA, identidade visual |
| Gabriel | `<login>` | *a definir* + Dev | Backend e banco: Prisma, modelagem, APIs, nginx e HTTPS |
| Diego | `<login>` | *a definir* + Dev | Usuários e segurança: autenticação, perfis, OAuth, 2FA, GDPR |
| Rafael | `<login>` | *a definir* + Dev | Social e tempo real: amigos, chat, WebSockets, notificações |
| Eduardo | `<login>` | *a definir* + Dev | IA e complementos: LLM, RAG, gamificação |

## Project Management

<!-- Descrever o que o time faz DE FATO. Base: docs/PLANO.md. -->

- **Organização:** 5 áreas, uma por pessoa, cada uma dona dos próprios módulos ([docs/PLANO.md](docs/PLANO.md)). Requisitos e status de cada módulo em [docs/MODULOS.md](docs/MODULOS.md).
- **Ferramentas:** GitHub (código, PRs), documentação versionada em `docs/`. *(a completar)*
- **Comunicação:** *(a completar)*

## Technical Stack

<!-- Justificativas: docs/decisoes/README.md. A coluna "Estado" diz o que já está no código. -->

| Camada | Tecnologia | Estado | Por quê |
|---|---|---|---|
| Frontend | Next.js 16 (React 19, App Router) | Em uso (`apps/web`) | Framework full-stack escolhido pelo time |
| Frontend | Tailwind CSS 4 + design system próprio | Tailwind em uso (tema em `globals.css`); design system a fazer | Solução de estilo exigida; base para os tokens |
| Frontend | PWA (manifest + service worker), Leaflet | Planejado | Módulo de PWA; mapas simples de integrar |
| Backend | Next.js (Route Handlers, Server Actions) | Em uso | Um app só para front e back ([decisões](docs/decisoes/README.md)) |
| Banco | PostgreSQL 18 + PostGIS + pgvector, via Prisma 7 (`@prisma/adapter-pg`) | Em uso | Relacional com schema legível; pgvector para o RAG |
| Tempo real | Socket.IO | Planejado (forma em aberto) | WebSockets com salas e reconexão |
| Autenticação | Better Auth (e-mail e senha, adapter Prisma) | Rotas `/api/auth/*` e rate limit; telas a fazer | Hash com salt pronto; plugins de OAuth e 2FA |
| IA | *provedor a definir* + embeddings locais + pgvector | Planejado | [docs/decisoes/llm.md](docs/decisoes/llm.md) |
| Infra | Docker Compose (imagens Alpine próprias), Docker secrets, Makefile | Em uso | Comando único exigido pelo subject |
| Infra | nginx (TLS, proxy reverso) | Em uso | HTTPS exigido pelo subject; único ponto de entrada, os outros containers ficam na rede interna |
| Qualidade | Biome (lint e formatação), TypeScript | Em uso | — |

## Database Schema

<!-- Atualizado por: Gabs. Fonte da verdade: apps/web/prisma/schema.prisma. Atualize o diagrama quando mudar uma relação. -->

Um banco (`POSTGRES_DB`, padrão `trails`) com **um schema Prisma**: [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma). As tabelas de comunidades, eventos e posts existem, mas essas funcionalidades estão adiadas.

```mermaid
erDiagram
  User ||--o{ Session : "tem"
  User ||--o{ Account : "tem"
  User |o--o{ Trail : "cria"
  User ||--o{ Activity : "registra"
  Trail |o--o{ Activity : "referencia"
  User ||--o{ CommunityMember : "participa"
  Community ||--o{ CommunityMember : "tem"
  Community ||--o{ Event : "organiza"
  User ||--o{ Event : "organiza"
  Event ||--o{ EventParticipant : "tem"
  User ||--o{ EventParticipant : "participa"
  User ||--o{ Post : "escreve"
  Community |o--o{ Post : "contém"
  User ||--o{ Notification : "recebe"
  User ||--o{ UserBadge : "conquista"
  Badge ||--o{ UserBadge : "concedido"
```

| Grupo | Tabelas | Campos principais |
|---|---|---|
| Better Auth | `User`, `Session`, `Account`, `Verification` | Formato exigido pelo Better Auth (a senha fica em `Account.password`) |
| Trilhas | `Trail`, `Activity` | `Trail`: origem (`source`: `OSM`/`USER`, com `externalId` para o OSM), distância e desnível em metros, `difficulty` (`EASY`/`MODERATE`/`HARD`), `visibility` (`PUBLIC`/`PRIVATE`), percurso em `routeGeoJSON` (JSON) e bounding box (`minLat`…`maxLon`); autor opcional (nulo nas trilhas do OSM). `Activity`: distância, duração em segundos, `polyline`, trilha opcional |
| Social | `Community`, `CommunityMember`, `Event`, `EventParticipant`, `Post`, `Notification` | Papel do membro: `ADMIN`/`MODERATOR`/`MEMBER`; pares únicos (`userId`+`communityId`, `eventId`+`userId`) |
| Gamificação | `Badge`, `UserBadge` | Um emblema por usuário no máximo uma vez |

IDs do Better Auth são gerados pela biblioteca; os demais usam `cuid()`. Toda chave estrangeira apaga em cascata (exceto `Activity.trailId`, que vira nulo).

## Features List

<!--
Atualizado por: quem entregar a funcionalidade, no mesmo PR.
Formato: | Funcionalidade | Descrição | Responsável(is) |
-->

| Funcionalidade | Descrição | Responsável(is) |
|---|---|---|
| Catálogo de trilhas do OSM | 3.878 trilhas importadas de um SQLite versionado no start do container, sem internet | Gabriel |
| Busca de trilhas (API) | `GET /api/trails` com filtros (texto, dificuldade, distância, desnível, área do mapa, raio), ordenação e paginação; `GET /api/trails/[id]`; trilha privada só para o autor | Gabriel |
| Trilhas e atividades (backend) | Server actions de criar, editar e excluir; distância, desnível e tempo calculados no servidor; estatísticas de atividades. Telas a fazer | Gabriel |

## Modules

<!-- Atualizado por: dono de cada módulo. Base: docs/MODULOS.md. -->

| Módulo | Tipo | Pts | Justificativa e implementação | Responsável(is) |
|---|---|---|---|---|
| Framework de frontend (Next.js) | Minor | 1 | | Juh |
| Framework de backend (Next.js) | Minor | 1 | O backend roda no próprio Next.js, no servidor: **Route Handlers** (`src/app/api/**/route.ts`) para leituras por URL, como `GET /api/trails`, e **Server Actions** (`src/server/<área>/actions.ts`) para os formulários. As regras ficam em `src/server/<área>/service.ts`; erros, validação (Zod) e paginação são comuns a todas as rotas, em `src/server/api/` | Gabriel |
| ORM (Prisma) | Minor | 1 | | Gabriel |
| Gerenciamento padrão de usuários | Major | 2 | | Diego |
| Interação entre usuários | Major | 2 | | Rafael |
| Recursos em tempo real (WebSockets) | Major | 2 | | Rafael |
| Interface de LLM | Major | 2 | | Eduardo |
| Sistema RAG | Major | 2 | | Eduardo |
| PWA com suporte offline e instalação | Minor | 1 | | Juh |
| Autenticação via OAuth 2.0 | Minor | 1 | | Diego |
| Sistema de gamificação | Minor | 1 | | Eduardo |
| Conformidade com GDPR | Minor | 1 | | Diego |
| Sistema completo de notificações | Minor | 1 | | Rafael |
| Autenticação de dois fatores (2FA) | Minor | 1 | | Diego |
| Design system próprio | Minor | 1 | | Juh |
| **Subtotal** | | **20** | | |
| Exportação e importação de dados *(opcional)* | Minor | 1 | | Gabriel |
| Dashboard de análise *(opcional)* | Major | 2 | | Gabriel |

## Individual Contributions

<!--
ESCRITO POR CADA PESSOA, sobre si mesma (agentes de IA não preenchem esta seção).
Base: a seção "Como eu explicaria isso na avaliação" das suas PRs.
-->

### Eduardo
*(a completar)*

### Juh
*(a completar)*

### Gabriel
*(a completar)*

### Diego
*(a completar)*

### Rafael
*(a completar)*

## Licenças e créditos

- Dados de mapa e trilhas © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), sob a licença ODbL. O catálogo derivado incluído neste repositório também está sob ODbL.
- Dados de elevação: Copernicus DEM GLO-90, via [Open-Meteo](https://open-meteo.com/).
- Trechos da Wikipedia usados no assistente: CC BY-SA, com a fonte citada em cada resposta.
