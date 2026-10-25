# Decisões

> Última atualização: 2026-10-25 — decisões de conta (Di): actions de login, avatar no banco, 2FA.

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
| **nginx nas portas 8443 (HTTPS) e 8080 (HTTP, só redireciona)**, configuráveis no `.env` | 443 e 80 podem estar ocupadas ou exigir root nas máquinas da avaliação |
| **WebSocket num servidor customizado do Next.js** (`apps/web/server.mjs`, Socket.IO no mesmo processo e porta) | Sem container nem rota nova no nginx; o `notify()` emite direto. Plano: [websocket-servidor.md](../agente/planos/websocket-servidor.md) |
| **HTTPS com CA local**: o `make` gera com `openssl` uma CA válida só para `localhost` e o certificado do nginx; importa-se o `ca.crt` no Chrome uma vez | O Chrome não registra service worker (PWA) com certificado autoassinado; nada a instalar na máquina (sem mkcert). A restrição a `localhost` impede usar a CA para falsificar outros sites |
| **Login e cadastro por Server Actions que chamam o Better Auth pelo caminho HTTP** (`auth.handler`, em `src/server/auth/http.ts`) | Erro volta como valor (sem 401 no console) e o rate limit continua valendo: ele só existe no caminho HTTP, não em `auth.api.*` |
| **Avatar no banco** (tabela `Avatar`), redimensionado no navegador para 256×256 WebP | Fora da pasta pública sem mexer no Docker; entra no backup do banco; o canvas descarta o EXIF (GPS) |
| **2FA só no login com e-mail e senha**; contas OAuth não ativam 2FA aqui | No OAuth quem autentica é o provedor (GitHub e 42 têm o próprio 2FA); o plugin do Better Auth só intercepta `/sign-in/email` |
| **E-mail por um cliente SMTP próprio** (`src/server/email/`, sem dependência) para o Mailpit em dev e na avaliação; sem servidor, o e-mail vai para o log | GDPR exige e-mails de confirmação; o Mailpit mostra os e-mails numa página, o que serve para a demo |
| **Exclusão da conta em 2 passos**: senha, depois link por e-mail que abre uma página com botão | O link é de uso único e só vale logado na conta; abrir o link (GET) nunca apaga nada |
| **Excluir a conta apaga tudo do usuário em cascata** | Comunidades e eventos estão adiados; se voltarem, o evento passa a ficar sem organizador (`SetNull`) em vez de sumir para todos |

## Propostas (aceitar ou trocar)

| Decisão | Por quê | Quem decide |
|---|---|---|
| **Leaflet** (react-leaflet) com tiles OSM ou OpenTopoMap configuráveis por variável | Simples de aprender; trocar de provedor evita erro de tile bloqueado no console | Juh + dono do catálogo |
| **Recharts** para gráficos | Natural em React; serve o dashboard e as estatísticas | Gabs + Juh |
| **Embeddings locais** (modelo multilíngue pequeno) + pgvector | Sem custo, offline, reprodutível. Ver [llm.md](llm.md) | Edu |

## Pendentes

| Pergunta | Opções | Quem decide | Afeta |
|---|---|---|---|
| **Provedor de LLM** e orçamento | Ver [llm.md](llm.md) | Edu (com o time, se houver custo) | Módulos 7 e 8 |
| **Comunidades e eventos** (tabelas já existem) | Adiado; voltar a discutir se sobrar tempo | Time | Notificações, schema |
