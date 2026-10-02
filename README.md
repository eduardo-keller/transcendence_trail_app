*This project has been created as part of the 42 curriculum by <login_eduardo>, <login_ju>, <login_gabriel>, <login_diego>, <login_rafael>.*

<!--
README EXIGIDO PELO SUBJECT (capítulo VI) E AVALIADO.
- A primeira linha acima é obrigatória, em itálico e com esse texto exato. Troque os <login_*> pelos logins da 42.
- Este arquivo é um RASCUNHO VIVO: cada seção diz quem atualiza e quando.
- Checklist das seções obrigatórias: docs/EVALUATION.md §3.
- Documentação interna do time: docs/README.md.
-->

# Trilhas SP *(nome provisório)*

## Description

**Trilhas SP** é uma plataforma de trilhas para São Paulo e cidades do entorno, inspirada no Wikiloc. Os dados vêm do OpenStreetMap: o usuário descobre trilhas, vê percurso, distância, desnível e perfil de elevação, registra as trilhas que fez, conversa com amigos em tempo real, participa de comunidades e tira dúvidas com um assistente de IA que conhece as trilhas da região.

**Funcionalidades principais:**
- Catálogo de trilhas do OpenStreetMap com mapa, busca avançada (filtros, ordenação e paginação) e página de detalhe com perfil de elevação.
- Perfis, avatar, amigos com status online e chat 1:1 em tempo real.
- Comunidades públicas e privadas, com posts, comentários e anexos.
- Notificações em tempo real para as ações do usuário.
- Assistente de IA: perguntas sobre trilhas com fontes (RAG) e planejador de trilha com streaming (LLM).
- Arquitetura de microsserviços com monitoramento (Prometheus e Grafana), status page e backups automáticos.

<!-- Atualizado por: PO. Quando: ao fechar o M2 (revisar a lista). -->

## Instructions

> 🚧 Preenchido pela frente Plataforma no Sprint 0 ([docs/frentes/plataforma](docs/frentes/plataforma/README.md)).

### Pré-requisitos
- Docker e Docker Compose *(versões: a definir)*
- GNU Make
- Navegador: Google Chrome (versão estável mais recente)

### Configuração
1. `cp .env.example .env` *(ou deixe o `make` gerar o arquivo com segredos aleatórios)*
2. Preencha a chave do provedor de LLM (`LLM_API_KEY`) e as demais variáveis indicadas no `.env.example`.

### Execução
```bash
make            # sobe tudo (build + containers)
```
Acesse **https://localhost:8443** (o certificado é autoassinado: aceite o aviso do navegador).

*(a completar: comandos de parada, logs, backup e restauração, e como rodar em modo de desenvolvimento)*

## Resources

### Referências
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Better Auth: https://www.better-auth.com/docs
- Socket.IO: https://socket.io/docs/v4/
- PostGIS: https://postgis.net/documentation/
- pgvector: https://github.com/pgvector/pgvector
- OpenStreetMap: https://wiki.openstreetmap.org/wiki/Map_features
- Prometheus: https://prometheus.io/docs/ · Grafana: https://grafana.com/docs/
- *(cada frente adiciona as referências que usou)*

### Uso de IA
<!--
OBRIGATÓRIO pelo subject: descrever como a IA foi usada, em quais tarefas e em quais partes do projeto.
Fonte: o campo "Uso de IA nesta PR" de cada PR. O PM consolida no M3.
-->
*(a completar no M3)*

## Team Information

<!-- Atualizado por: PM, no kickoff. -->

| Membro | Login | Papel(is) | Responsabilidades |
|---|---|---|---|
| Eduardo | `<login>` | *a definir* + Dev (frente *a definir*) | |
| Ju | `<login>` | *a definir* + Dev (frente *a definir*) | |
| Gabriel | `<login>` | *a definir* + Dev (frente *a definir*) | |
| Diego | `<login>` | *a definir* + Dev (frente *a definir*) | |
| Rafael | `<login>` | *a definir* + Dev (frente *a definir*) | |

## Project Management

<!-- Atualizado por: PM. Base: docs/PROCESS.md. -->

- **Organização:** 5 frentes de trabalho, cada uma com um dono; sprints semanais; planejamento às segundas, daily assíncrona, demo e "aula relâmpago" às sextas, retro quinzenal.
- **Ferramentas:** GitHub Issues + GitHub Projects (tarefas), documentação versionada em `docs/` (arquitetura, ADRs, contratos, status), PRs com revisão obrigatória.
- **Comunicação:** Discord (canais de daily, dev, PRs, bloqueios, decisões e alertas automáticos).

## Technical Stack

<!-- Atualizado por: Tech Lead. Justificativas detalhadas: docs/adr/. -->

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | Next.js (React, App Router), Tailwind CSS, shadcn/ui, Leaflet, Recharts | Framework full-stack escolhido pelo time; componentes acessíveis; mapas simples de integrar |
| Backend | Next.js (Route Handlers, Server Actions) + serviços Fastify (TypeScript) | Ver [ADR-0001](docs/adr/0001-arquitetura-servicos.md) e [ADR-0002](docs/adr/0002-monorepo-typescript.md) |
| Banco | PostgreSQL + PostGIS + pgvector, via Prisma | Relacional e confiável; dados geoespaciais e vetoriais no mesmo motor ([ADR-0003](docs/adr/0003-banco-de-dados.md)) |
| Tempo real | Socket.IO + Redis pub/sub | [ADR-0005](docs/adr/0005-comunicacao.md) |
| Autenticação | Better Auth | [ADR-0004](docs/adr/0004-autenticacao.md) |
| IA | *provedor a definir* + embeddings locais + pgvector | [ADR-0007](docs/adr/0007-provedor-llm-embeddings.md) |
| Infra | Docker Compose, nginx (TLS), Prometheus, Grafana, Alertmanager | Módulos de DevOps |

## Database Schema

<!-- Atualizado por: Tech Lead no M3, gerado a partir dos schemas Prisma. Esboço atual: docs/ARCHITECTURE.md §5. -->
*(a completar: diagrama de cada banco (`web`, `realtime`, `trails`, `ai`), tabelas, relações, campos principais e tipos)*

## Features List

<!--
Atualizado por: quem entregar a funcionalidade, no mesmo PR (AGENTS.md §7).
Formato: | Funcionalidade | Descrição | Responsável(is) |
-->

| Funcionalidade | Descrição | Responsável(is) |
|---|---|---|
| | | |

## Modules

<!-- Atualizado por: donos das frentes. Base: docs/MODULES.md. -->

| Módulo | Tipo | Pts | Justificativa e implementação | Responsável(is) |
|---|---|---|---|---|
| Framework frontend + backend (Next.js) | Major* | 2 | | |
| ORM (Prisma) | Minor | 1 | | |
| Gerenciamento padrão de usuários | Major | 2 | | |
| Interação entre usuários | Major | 2 | | |
| Recursos em tempo real (WebSockets) | Major | 2 | | |
| Backend em microsserviços | Major | 2 | | |
| Busca avançada | Minor | 1 | | |
| Upload e gestão de arquivos | Minor | 1 | | |
| Sistema de notificações | Minor | 1 | | |
| Interface de LLM | Major | 2 | | |
| Sistema RAG | Major | 2 | | |
| Monitoramento (Prometheus + Grafana) | Major | 2 | | |
| Health check, status page e backups | Minor | 1 | | |
| **Total** | | **21** | | |

\* Equivalente aos Minors "frontend framework" + "backend framework" (ver [docs/MODULES.md](docs/MODULES.md#1-pontuação)).

## Individual Contributions

<!--
ESCRITO POR CADA PESSOA, sobre si mesma (agentes de IA não preenchem esta seção).
Base: as seções "O que aprendi" das suas PRs + docs/LEARNING.md §5 (lições aprendidas).
-->

### Eduardo
*(a completar)*

### Ju
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
