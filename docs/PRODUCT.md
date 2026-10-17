# Produto

> Última atualização: 2026-10-17 — alinhado ao schema atual: trilhas publicadas por usuários (com visibilidade), atividades, eventos de comunidade, emblemas, papéis `ADMIN`/`MODERATOR`/`MEMBER` e rota `/login`.
> Dono: Product Owner.

## 1. Visão

**Trilhas SP** (nome provisório) é uma plataforma de trilhas para São Paulo e cidades do entorno, inspirada no [Wikiloc](https://pt.wikiloc.com/). O usuário descobre trilhas (um catálogo inicial vindo do OpenStreetMap e trilhas publicadas por outros usuários), vê percurso, distância e desnível, publica as próprias trilhas, registra as atividades que fez, conversa com amigos, participa de comunidades e dos eventos (saídas) que elas organizam, ganha emblemas e tira dúvidas com um assistente de IA que conhece as trilhas da região.

**Para quem:** quem faz trilhas na Grande São Paulo, de iniciantes que querem algo perto de casa a grupos que organizam saídas.

**Por que alguém usaria:** reúne num só lugar o catálogo de trilhas locais, o registro das próprias atividades, a parte social (amigos, comunidades, eventos, chat) e um assistente que responde perguntas como "trilha fácil com cachoeira perto de Mairiporã?".

> Lembrete: este é um projeto de avaliação. O produto existe para **atender os módulos escolhidos** ([MODULES.md](MODULES.md)) de forma coerente. Funcionalidade que não ajuda a passar nem a aprender fica para depois.

## 2. Região de abrangência

- Retângulo inicial do catálogo do OSM (sul, oeste, norte, leste): `-24.05, -47.10, -23.00, -46.20`. Cobre a Grande São Paulo, Serra da Cantareira, Jaraguá, Serra do Japi (Jundiaí), Atibaia, Mairiporã, Paranapiacaba e parte da Serra do Mar.
- O retângulo é **configurável** no pipeline de ingestão. Pode ser ampliado (Bertioga, litoral norte) se o catálogo ficar pequeno. Ver [research/osm-trilhas.md](research/osm-trilhas.md).
- Trilhas publicadas por usuários podem estar em qualquer lugar.

## 3. Páginas

Hoje existem só `/` (página de boas-vindas) e `/login` (formulário ainda sem autenticação). As demais são planejadas.

| # | Página | Rota | Principais funcionalidades | Módulos que ajuda a provar |
|---|---|---|---|---|
| 1 | **Home** | `/` | Apresentação, CTA de cadastro e login, trilhas em destaque, atalhos para busca, comunidades e assistente | Frameworks |
| 2 | **Trilhas e mapa** | `/trilhas` | Cards de trilhas + mapa lado a lado; filtros, ordenação e paginação refletidos na URL; "perto de mim"; filtrar pela área visível do mapa | Busca avançada |
| 3 | **Perfil** | `/u/[id]` | Dados do usuário, avatar, estatísticas (km, desnível, atividades), trilhas publicadas, atividades, emblemas, amigos com status online | Gerenciamento de usuários, Interação |
| 4 | **Detalhe da trilha** | `/trilhas/[id]` | Mapa do percurso, distância, desnível, dificuldade, autor, "registrar atividade nesta trilha", "perguntar ao assistente sobre esta trilha", aviso de segurança | Busca, RAG, Notificações |
| 5 | **Comunidades** | `/comunidades`, `/comunidades/[id]` | Lista e busca, "minhas comunidades", entrar e sair, posts, eventos (saídas) com participantes, feed atualizado em tempo real | Tempo real, Notificações, Upload |

Páginas de apoio:

| Página | Rota | Observação |
|---|---|---|
| Login e cadastro | `/login`, `/cadastro` | Obrigatório pelo subject. `/login` já existe (sem lógica) |
| Editar perfil | `/config/perfil` | Nome, avatar (e bio e cidade, quando os campos existirem) |
| Publicar trilha | `/trilhas/nova` | A partir de um arquivo GPX: gera o percurso, a distância e o desnível; o autor escolhe a visibilidade |
| Registrar atividade | `/atividades/nova` | Título, data, distância, duração, percurso (GPX) e trilha opcional |
| Amigos | `/amigos` | Pedidos recebidos e enviados, lista com status online |
| Mensagens | `/mensagens` | Chat 1:1 |
| Notificações | sino no header + `/notificacoes` | Não lidas, marcar como lida |
| Assistente | `/assistente` | Duas abas: **Perguntar** (RAG) e **Planejar trilha** (LLM) |
| Ranking | `/ranking` | Km somados das atividades, geral e entre amigos |
| Meus arquivos | `/config/arquivos` | Lista, preview e exclusão dos uploads |
| Status | `/status` | Saúde dos serviços e último backup |
| Privacidade e Termos | `/privacidade`, `/termos` | **Obrigatórias**, com links no rodapé, sem conteúdo placeholder |

## 4. Escopo priorizado (MoSCoW)

**Must (sem isso não passa):**
- Cadastro e login com e-mail e senha; validação no front e no back.
- Catálogo de trilhas (OSM + publicadas por usuários) com lista, mapa e detalhe (distância, desnível, dificuldade).
- Busca com filtros, ordenação e paginação.
- Perfil (ver e editar), avatar com padrão, amigos (adicionar, remover, listar) com status online.
- Chat 1:1 em tempo real.
- Notificações persistentes e em tempo real para ações de criar, editar e excluir.
- Upload de arquivos (imagens, PDF, GPX) com validação, preview, progresso e exclusão.
- Comunidades com membros e papéis, posts e comentários.
- Assistente: perguntas sobre trilhas com fontes (RAG) e planejador de trilha com streaming (LLM).
- Observabilidade, status page e backups (módulos de DevOps).
- Páginas de Privacidade e Termos com conteúdo real.

**Should (agrega valor, custo baixo):**
- Publicar trilha a partir de GPX, com visibilidade pública ou privada.
- Registrar atividades e ranking por km.
- Eventos de comunidade (saídas com data, organizador e participantes).
- Comunidades privadas (visibilidade e entrada por solicitação).
- Feed de comunidade atualizando ao vivo.
- "Perguntar sobre esta trilha" a partir da página de detalhe.

**Could (só depois do marco M2; ver módulos reserva em [MODULES.md](MODULES.md#3-módulos-reserva)):**
- Login com 42/GitHub (OAuth), 2FA.
- Gamificação completa (XP, níveis). Os emblemas (`Badge`, `UserBadge`) já existem no schema.
- Previsão do tempo na página da trilha.
- Exportar a trilha em GPX.

**Won't (fora de escopo):** gravação de GPS ao vivo, app mobile nativo, navegação curva a curva, mapas offline, múltiplos idiomas, pagamentos.

## 5. Regras de produto

Estas regras definem permissões e privacidade. O PO valida; mudanças exigem atualizar este doc. Entre colchetes, o campo do schema que sustenta a regra.

- **Chat:** 1:1 e **somente entre amigos**. Simplifica permissões e evita spam.
- **Perfil público:** nome, avatar [`User.name`, `User.image`], estatísticas, trilhas públicas, atividades e emblemas. Bio, cidade e username quando esses campos existirem. **E-mail nunca é público.**
- **Amizade:** pedido → aceito ou recusado. Qualquer lado pode desfazer. Se A pede para B enquanto B já pediu para A, a amizade é aceita automaticamente.
- **Trilha:** toda trilha tem um autor [`Trail.authorId`]. Visibilidade [`Trail.visibility`]: `PUBLIC` aparece na busca para todos; `PRIVATE` só para o autor. Só o autor edita ou exclui. As trilhas importadas do OSM pertencem a uma conta do sistema (a definir na implementação).
- **Atividade:** registro pessoal de uma saída [`Activity`]: título, data de início, distância, duração, percurso opcional e trilha opcional. Se a trilha for excluída, a atividade continua, sem a trilha. **O percurso é visível só para o dono**, porque revela por onde a pessoa andou.
- **Comunidade:** qualquer usuário logado lê; precisa entrar para postar. Comunidades privadas (visíveis só para membros, com entrada por solicitação) são planejadas e exigem novos campos no schema.
- **Papéis na comunidade** [enum `Role`]: `ADMIN` (edita e exclui a comunidade, gerencia membros e papéis; quem cria vira `ADMIN`), `MODERATOR` (remove posts, gerencia eventos), `MEMBER`. Um membro por comunidade no máximo uma vez [`UNIQUE(userId, communityId)`].
- **Eventos:** uma comunidade organiza saídas [`Event`]: título, descrição, data e organizador. Membros participam [`EventParticipant`, um registro por pessoa].
- **Posts:** texto com mídia opcional [`Post.content`, `Post.mediaUrl`]. Com `communityId`, o post é da comunidade; sem ele, aparece no perfil do autor.
- **Ranking:** soma de km das atividades [`Activity.distance`]. Visões geral e entre amigos.
- **Dificuldade:** `EASY`, `MODERATE` ou `HARD` [`Trail.difficulty`], calculada a partir de distância e desnível (padrão `MODERATE`). A página explica o critério.
- **Emblemas:** concedidos automaticamente por conquistas (ex.: primeira atividade, 100 km somados); cada emblema uma vez por usuário [`UNIQUE(userId, badgeId)`].
- **Segurança:** toda página de trilha mostra um aviso de que os dados podem estar imprecisos e que trilhas envolvem riscos.
- **IA:** o assistente informa que as respostas são geradas por IA e podem conter erros. As perguntas são enviadas a um provedor externo (isso consta na Política de Privacidade).

## 6. Fontes de dados e atribuições obrigatórias

| Fonte | Uso | Licença ou condição | Onde atribuir |
|---|---|---|---|
| OpenStreetMap | Catálogo inicial de trilhas, pontos de interesse | ODbL: "© OpenStreetMap contributors" + link; base derivada também sob ODbL | Mapa (canto), rodapé, Termos, README |
| Tiles do mapa (OSM ou OpenTopoMap) | Fundo do mapa | Política de uso de cada provedor | Mapa |
| Open-Meteo / Copernicus DEM | Elevação | Atribuição a Copernicus e Open-Meteo | Página da trilha, README |
| Wikipedia (pt) | Corpus do RAG | CC BY-SA, com atribuição e link | Fontes da resposta do assistente, README |
| Usuários | Trilhas publicadas e atividades | Termos de Uso (o usuário garante que pode publicar o percurso) | Página da trilha (autor) |

**Proibido:** copiar dados do Wikiloc, AllTrails ou similares (os termos de uso não permitem).
