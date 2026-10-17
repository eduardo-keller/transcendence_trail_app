# Decisões

> Última atualização: 2026-10-17 — substitui as ADRs 0001–0009 (versão antiga na tag `docs-v1`).

Uma linha por decisão. A coluna "Por quê" alimenta a seção *Technical Stack* do README, que pede a justificativa das escolhas.
Decidiu algo que afeta outra pessoa? Acrescente uma linha no mesmo PR. Se precisar de mais espaço, crie um arquivo nesta pasta e ponha o link.

## Tomadas

| Decisão | Por quê |
|---|---|
| **Um app Next.js** (front + back), sem microsserviços | O módulo de microsserviços saiu da lista; menos peças para configurar, depurar e explicar |
| **PostgreSQL 18 + Prisma 7**, um banco só, com PostGIS e pgvector instalados | Módulo de ORM; schema legível (exigência obrigatória); pgvector serve o RAG sem outro banco |
| **Percurso da trilha em JSON + bounding box** (`routeGeoJSON`, `minLat`…`maxLon`) | Filtrar pela área do mapa com Prisma puro, sem SQL espacial |
| **Better Auth** (e-mail e senha, sessão no banco com cookie `HttpOnly`) | Hash com salt pronto; plugins prontos para OAuth e 2FA (módulos da Di); sessão revogável |
| **Docker Compose + Makefile**, imagens Alpine próprias, senhas como Docker secrets | `make` é o comando único exigido; senha nunca no `.env` |
| **Trilhas importadas offline do OSM** e versionadas no repo; nada de Overpass em tempo de execução | A API pública do Overpass é instável (504); a avaliação não pode depender dela. Detalhes em [dados-trilhas.md](../dados-trilhas.md) |
| **Tailwind CSS 4** como solução de estilo | Exigência obrigatória; base para os tokens do design system |
| **Nenhum dado do Wikiloc, AllTrails ou similares** | Os termos de uso proíbem extração |

## Propostas (aceitar ou trocar)

| Decisão | Por quê | Quem decide |
|---|---|---|
| **Leaflet** (react-leaflet) com tiles OSM ou OpenTopoMap configuráveis por variável | Simples de aprender; trocar de provedor evita erro de tile bloqueado no console | Juh + dono do catálogo |
| **Recharts** para gráficos | Natural em React; serve o dashboard e as estatísticas | Gabs + Juh |
| **Embeddings locais** (modelo multilíngue pequeno) + pgvector | Sem custo, offline, reprodutível. Ver [llm.md](llm.md) | Edu |

## Pendentes

| Pergunta | Opções | Quem decide | Afeta |
|---|---|---|---|
| **Como o WebSocket roda?** As rotas do Next.js não mantêm conexão aberta | (a) container separado com Socket.IO no mesmo repo, usando o mesmo Prisma; (b) servidor customizado do Next.js | Rafa + Gabs | Rafa, Gabs, nginx |
| **Certificado HTTPS que não quebre o PWA** | Autoassinado (o Chrome não registra service worker com erro de certificado) × certificado de uma CA local (ex.: mkcert) instalada na máquina da avaliação | Gabs + Juh | PWA, OAuth |
| **Envio de e-mail** (GDPR exige e-mails de confirmação) | Mailpit no compose em dev; em produção, SMTP real ou só o Mailpit | Di | GDPR, 2FA |
| **Provedor de LLM** e orçamento | Ver [llm.md](llm.md) | Edu (com o time, se houver custo) | Módulos 7 e 8 |
| **Comunidades e eventos** (tabelas já existem) | Adiado; voltar a discutir se sobrar tempo | Time | Notificações, schema |
