# Aprendizado

> Última atualização: 2026-10-01
> Todos mantêm. Aprendeu algo que custou caro? Adicione uma entrada curta aqui.

Estamos fazendo este projeto **para aprender**, mas com prazo. Este documento ajuda a encontrar o equilíbrio: o que estudar, quando e quanto.

## 1. Como aprender sem travar a entrega

1. **Aprenda no ponto de uso.** Não estude Prometheus inteiro antes de começar. Estude o suficiente para a próxima tarefa: 30–60 min de documentação oficial **antes** de uma funcionalidade nova, o resto na prática.
2. **IA como tutora, não como oráculo.** Peça "explique por que", "quais alternativas existem", "me faça perguntas para ver se entendi" (prompts em [PROCESS.md](PROCESS.md#prompts-prontos)).
3. **Escreva você a parte central** do seu módulo; deixe o boilerplate para a IA.
4. **Explique de volta.** Se você não consegue explicar em 2 minutos o que o seu código faz, ainda não aprendeu, e o avaliador vai perceber.
5. **Aula relâmpago de sexta:** cada semana alguém explica um conceito para o time (15 min). Ensinar é a melhor forma de aprender, e prepara todos para a avaliação.
6. **Revise PRs de outras frentes.** É o jeito mais barato de conhecer o projeto inteiro.

## 2. O mínimo que TODOS precisam saber

Na avaliação, qualquer membro pode ser perguntado sobre qualquer parte. Cada pessoa deve conseguir explicar, sem consultar:

- [ ] A arquitetura: os 4 serviços, o que cada um faz e por que existem separados.
- [ ] O caminho de uma requisição: navegador → nginx (HTTPS) → web → serviço interno → banco.
- [ ] Como funciona o login e por que a senha é segura (hash com salt, sessão em cookie).
- [ ] Como uma mensagem de chat chega ao outro usuário (WebSocket, salas).
- [ ] Como uma notificação é criada e entregue (evento → Redis → realtime → banco + socket).
- [ ] O que é RAG e como o assistente encontra os trechos (embeddings, busca vetorial).
- [ ] De onde vêm os dados de trilha e como o desnível é calculado.
- [ ] O que o Prometheus coleta e como um alerta dispara.
- [ ] Como subir o projeto e como restaurar um backup.
- [ ] Como o time se organizou (papéis, rituais, git, PRs).

## 3. Glossário por área

Formato: o que é, em 1–3 linhas, e onde aparece no projeto. Explicações mais longas estão nas caixas 💡 dos documentos indicados.

### Arquitetura
- **Microsserviços:** backend dividido em serviços independentes, cada um com uma responsabilidade e seu banco. → [ARCHITECTURE §1](ARCHITECTURE.md#1-visão-geral), [ADR-0001](adr/0001-arquitetura-servicos.md)
- **BFF (Backend for Frontend):** a camada que o navegador enxerga e que orquestra os serviços internos. → o `web`
- **Proxy reverso:** servidor que recebe as requisições e repassa para os serviços certos. → nginx
- **Database-per-service:** cada serviço é dono do seu banco; os outros só acessam por API. → [ARCHITECTURE §5](ARCHITECTURE.md#5-dados)
- **Consistência eventual:** dados copiados entre serviços (snapshots, eventos) podem ficar diferentes por um instante. → snapshot em `TrailCompletion`
- **Contrato / contract-first:** a interface entre serviços é acordada antes de implementar. → [contracts](contracts/README.md)
- **Pub/sub:** quem publica não conhece quem assina; o broker (Redis) distribui. → eventos
- **Síncrono × assíncrono:** esperar a resposta (REST) × avisar e seguir (evento).
- **ADR:** registro de uma decisão de arquitetura com contexto e alternativas. → [adr/](adr/)

### Web e Next.js
- **App Router:** sistema de rotas do Next.js baseado em pastas (`app/trilhas/page.tsx` = `/trilhas`).
- **Server Component:** roda só no servidor, pode acessar dados direto e não manda JS ao navegador.
- **Client Component (`"use client"`):** roda no navegador; tem estado, efeitos e eventos.
- **Hydration:** o React "liga" no navegador o HTML que veio do servidor. Se o HTML for diferente (datas, aleatórios), dá erro no console.
- **Server Action:** função de servidor chamada direto de um formulário ou componente.
- **Route Handler:** endpoint HTTP no Next.js (`app/api/.../route.ts`).
- **SSR:** gerar o HTML no servidor a cada requisição.
- **WebSocket:** conexão bidirecional e persistente. → [F3](frentes/social/README.md#6-conceitos-chave)
- **SSE:** stream unidirecional do servidor para o cliente sobre HTTP. → [F5](frentes/ia/README.md#6-conceitos-chave)
- **CORS / mesma origem:** o navegador bloqueia chamadas a outras origens sem permissão. Evitamos o problema passando tudo pelo mesmo domínio (nginx).

### Segurança
- **Hash de senha + salt:** → [F2](frentes/identidade/README.md#6-conceitos-chave)
- **Cookie `HttpOnly`, `Secure`, `SameSite`:** → [ADR-0004](adr/0004-autenticacao.md)
- **CSRF:** um site malicioso faz o navegador enviar uma requisição autenticada a outro site. Mitigado com `SameSite` e checagem de origem.
- **XSS:** injetar script na página via conteúdo do usuário. Mitigado porque o React escapa o texto; nunca use `dangerouslySetInnerHTML` com conteúdo do usuário.
- **SQL injection:** dado do usuário vira parte da SQL. Mitigado com ORM e queries parametrizadas.
- **Autenticação × autorização:** quem você é × o que você pode fazer.
- **TLS / HTTPS:** criptografia do transporte; o certificado prova a identidade do servidor.
- **Rate limiting:** limitar requisições por usuário e por janela de tempo.

### Dados
- **ORM:** mapeia tabelas para objetos e gera queries seguras. → Prisma
- **Migration:** script versionado que altera o schema do banco.
- **Índice:** estrutura que acelera buscas (B-tree, GiST, GIN, HNSW).
- **Transação:** um grupo de operações que acontecem todas ou nenhuma.
- **Constraint `UNIQUE`:** o banco garante que não há duplicata, mesmo com acessos simultâneos.
- **Race condition:** resultado errado por causa de operações simultâneas.
- **Idempotência:** repetir a operação não muda o resultado.
- **Paginação offset × cursor:** → [F4](frentes/trilhas/README.md#6-conceitos-chave)
- **pg_trgm:** busca por similaridade de texto (tolera erros de digitação).

### Geo
- **OSM: node, way, relation, tags:** → [pesquisa](research/osm-trilhas.md#2-conceitos-como-o-osm-organiza-os-dados)
- **GeoJSON:** formato JSON de geometrias, com coordenadas em [lng, lat].
- **SRID 4326 (WGS 84):** latitude e longitude em graus.
- **geometry × geography:** plano × esfera. → [F4](frentes/trilhas/README.md#6-conceitos-chave)
- **DEM:** grade de altitudes do terreno (ex.: Copernicus de 90 m).
- **Tiles:** pequenas imagens (raster) ou dados (vetoriais) que compõem o mapa.
- **ODbL:** licença dos dados do OSM (atribuição + compartilhar derivados pela mesma licença).

### IA
- **LLM, token, janela de contexto:** → [F5](frentes/ia/README.md#6-conceitos-chave)
- **Embedding, similaridade de cosseno:** → F5
- **Chunking:** dividir documentos em trechos para indexar.
- **RAG:** recuperar trechos relevantes e então gerar a resposta com base neles.
- **HNSW:** índice de vizinhos aproximados para vetores.
- **Alucinação:** o modelo inventa algo plausível. O RAG com citações e "não sei" reduz isso.
- **Prompt injection:** texto que tenta mudar as instruções do modelo.

### DevOps
- **Imagem, container, volume, rede:** → [F1](frentes/plataforma/README.md#6-conceitos-chave)
- **Multi-stage build:** compilar num estágio e rodar num estágio enxuto.
- **Healthcheck, liveness, readiness:** → F1
- **Prometheus, exporter, PromQL, scrape:** → F1
- **RED / USE:** métodos para escolher o que monitorar.
- **Alertmanager:** recebe alertas do Prometheus e encaminha (Discord, e-mail).
- **Backup, restore, RPO, RTO:** → F1
- **CI:** cada push roda lint, testes e build automaticamente.

### Processo
- **Conventional Commits, GitHub Flow, rebase, squash merge:** → [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Definition of Ready / Done:** → [PROCESS.md](PROCESS.md#definition-of-ready-antes-de-puxar-uma-tarefa)
- **Walking skeleton:** a primeira versão que atravessa todas as camadas fazendo quase nada. → [ROADMAP §1](ROADMAP.md#1-estratégia)
- **MoSCoW:** priorização em Must, Should, Could e Won't. → [PRODUCT §4](PRODUCT.md#4-escopo-priorizado-moscow)

## 4. Trilhas de estudo por frente

Leitura **mínima** antes de começar (≈ 1–2 h) e "para aprofundar" quando sobrar tempo.

| Frente | Mínimo | Para aprofundar |
|---|---|---|
| Todos | [Next.js: tutorial do App Router](https://nextjs.org/learn) · [zod](https://zod.dev) · [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) | [React: Thinking in React](https://react.dev/learn/thinking-in-react) |
| F1 Plataforma | [Docker: get started](https://docs.docker.com/get-started/) · [Compose](https://docs.docker.com/compose/) · [Prometheus: overview](https://prometheus.io/docs/introduction/overview/) | [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) · [nginx WebSocket](https://nginx.org/en/docs/http/websocket.html) · [Google SRE: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/) |
| F2 Identidade | [Better Auth](https://www.better-auth.com/docs) · [Prisma: relações](https://www.prisma.io/docs) | [OWASP: autenticação](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) · [OWASP: file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) |
| F3 Social | [Socket.IO: tutorial + rooms](https://socket.io/docs/v4/) · [Fastify](https://fastify.dev/docs/latest/) | [MDN: WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) · Redis pub/sub |
| F4 Trilhas | [PostGIS workshop, capítulos 1–15](https://postgis.net/workshops/postgis-intro/) · [OSM Map Features](https://wiki.openstreetmap.org/wiki/Map_features) · [React Leaflet](https://react-leaflet.js.org) | [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) · [Turf.js](https://turfjs.org) |
| F5 IA | Documentação do SDK do provedor escolhido (streaming) · [pgvector](https://github.com/pgvector/pgvector) | [MDN: SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) · [Transformers.js](https://huggingface.co/docs/transformers.js) · avaliação de RAG |

## 5. Lições aprendidas

Registre aqui armadilhas reais que o time encontrou (curto: problema → causa → solução). Isso vira material para "challenges faced" no README.

| Data | Quem | Problema → causa → solução |
|---|---|---|
| | | |
