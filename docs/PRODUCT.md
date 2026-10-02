# Produto

> Última atualização: 2026-10-01 — visão inicial (a validar pelo PO no kickoff).
> Dono: Product Owner.

## 1. Visão

**Trilhas SP** (nome provisório) é uma plataforma de trilhas para São Paulo e cidades do entorno, inspirada no [Wikiloc](https://pt.wikiloc.com/). O usuário descobre trilhas a partir de dados abertos do OpenStreetMap, vê percurso, distância e desnível, registra as trilhas que já fez, conversa com amigos, participa de comunidades e tira dúvidas com um assistente de IA que conhece as trilhas da região.

**Para quem:** quem faz trilhas na Grande São Paulo, de iniciantes que querem algo perto de casa a grupos que organizam saídas.

**Por que alguém usaria:** reúne num só lugar o catálogo de trilhas locais, a parte social (amigos, comunidades, chat) e um assistente que responde perguntas como "trilha fácil com cachoeira perto de Mairiporã?".

> Lembrete: este é um projeto de avaliação. O produto existe para **atender os módulos escolhidos** ([MODULES.md](MODULES.md)) de forma coerente. Funcionalidade que não ajuda a passar nem a aprender fica para depois.

## 2. Região de abrangência

- Retângulo inicial (sul, oeste, norte, leste): `-24.05, -47.10, -23.00, -46.20`. Cobre a Grande São Paulo, Serra da Cantareira, Jaraguá, Serra do Japi (Jundiaí), Atibaia, Mairiporã, Paranapiacaba e parte da Serra do Mar.
- O retângulo é **configurável** no pipeline de ingestão. Pode ser ampliado (Bertioga, litoral norte) se o catálogo ficar pequeno. Ver [research/osm-trilhas.md](research/osm-trilhas.md).

## 3. Páginas

| # | Página | Rota (proposta) | Principais funcionalidades | Módulos que ajuda a provar |
|---|---|---|---|---|
| 1 | **Home** | `/` | Apresentação, CTA de cadastro e login, trilhas em destaque, atalhos para busca, comunidades e assistente | Frameworks |
| 2 | **Trilhas e mapa** | `/trilhas` | Cards de trilhas + mapa lado a lado; filtros, ordenação e paginação refletidos na URL; "perto de mim"; filtrar pela área visível do mapa | Busca avançada |
| 3 | **Perfil** | `/u/[username]` | Dados do usuário, avatar, estatísticas (km, desnível acumulado), trilhas realizadas, amigos com status online, posição no ranking | Gerenciamento de usuários, Interação |
| 4 | **Detalhe da trilha** | `/trilhas/[slug]` | Mapa do percurso, distância, desnível, perfil de elevação, dificuldade, tipo (circular ou linear), pontos de interesse, "marcar como realizada", "perguntar ao assistente sobre esta trilha", aviso de segurança | Busca, RAG, Notificações |
| 5 | **Comunidades** | `/comunidades`, `/comunidades/[slug]` | Comunidades públicas e privadas, "minhas comunidades", busca, entrar ou solicitar entrada, posts com anexos, comentários, feed atualizado em tempo real | Tempo real, Notificações, Upload |

Páginas de apoio:

| Página | Rota | Observação |
|---|---|---|
| Cadastro e login | `/cadastro`, `/entrar` | Obrigatório pelo subject |
| Editar perfil | `/config/perfil` | Nome, bio, cidade, avatar |
| Amigos | `/amigos` | Pedidos recebidos e enviados, lista com status online |
| Mensagens | `/mensagens` | Chat 1:1 |
| Notificações | sino no header + `/notificacoes` | Não lidas, marcar como lida |
| Assistente | `/assistente` | Duas abas: **Perguntar** (RAG) e **Planejar trilha** (LLM) |
| Ranking | `/ranking` | Geral e entre amigos |
| Meus arquivos | `/config/arquivos` | Lista, preview e exclusão dos uploads |
| Status | `/status` | Saúde dos serviços e último backup |
| Privacidade e Termos | `/privacidade`, `/termos` | **Obrigatórias**, com links no rodapé, sem conteúdo placeholder |

## 4. Escopo priorizado (MoSCoW)

**Must (sem isso não passa):**
- Cadastro e login com e-mail e senha; validação no front e no back.
- Catálogo de trilhas do OSM com lista, mapa e detalhe (distância, desnível, perfil de elevação).
- Busca com filtros, ordenação e paginação.
- Perfil (ver e editar), avatar com padrão, amigos (adicionar, remover, listar) com status online.
- Chat 1:1 em tempo real.
- Notificações persistentes e em tempo real para ações de criar, editar e excluir.
- Upload de arquivos (imagens, PDF, GPX) com validação, preview, progresso e exclusão.
- Comunidades públicas e privadas com posts e comentários.
- Assistente: perguntas sobre trilhas com fontes (RAG) e planejador de trilha com streaming (LLM).
- Observabilidade, status page e backups (módulos de DevOps).
- Páginas de Privacidade e Termos com conteúdo real.

**Should (agrega valor, custo baixo):**
- Trilhas realizadas e ranking por km.
- Feed de comunidade atualizando ao vivo.
- Exportar a trilha em GPX.
- "Perguntar sobre esta trilha" a partir da página de detalhe.

**Could (só depois do marco M2; ver módulos reserva em [MODULES.md](MODULES.md#3-módulos-reserva)):**
- Login com 42/GitHub (OAuth), 2FA.
- Gamificação: emblemas, XP, níveis.
- Trilhas criadas por usuários a partir de GPX.
- Previsão do tempo na página da trilha.

**Won't (fora de escopo):** gravação de GPS ao vivo, app mobile nativo, navegação curva a curva, mapas offline, múltiplos idiomas, pagamentos.

## 5. Regras de produto

Estas regras definem permissões e privacidade. O PO valida; mudanças exigem atualizar este doc.

- **Chat:** 1:1 e **somente entre amigos**. Simplifica permissões e evita spam.
- **Perfil público:** nome, username, avatar, bio, cidade, estatísticas e trilhas realizadas. **E-mail nunca é público.**
- **Amizade:** pedido → aceito ou recusado. Qualquer lado pode desfazer. Se A pede para B enquanto B já pediu para A, a amizade é aceita automaticamente.
- **Comunidade pública:** qualquer usuário logado lê; precisa entrar para postar e comentar.
- **Comunidade privada:** aparece na busca (nome e descrição), mas posts, membros e anexos são visíveis só para membros. A entrada é por solicitação aprovada pelo dono ou por um moderador.
- **Papéis na comunidade:** `owner` (edita, exclui, gerencia membros), `moderator` (aprova entradas, remove posts), `member`.
- **Trilha realizada:** data, nota opcional e GPX opcional. **O GPX é privado por padrão**, porque revela por onde a pessoa andou.
- **Ranking:** soma de km das trilhas realizadas. Visões geral e entre amigos.
- **Dificuldade:** fácil, moderada ou difícil, calculada a partir de distância e desnível. A página explica o critério.
- **Segurança:** toda página de trilha mostra um aviso de que os dados vêm do OSM e podem estar imprecisos, e que trilhas envolvem riscos.
- **IA:** o assistente informa que as respostas são geradas por IA e podem conter erros. As perguntas são enviadas a um provedor externo (isso consta na Política de Privacidade).

## 6. Fontes de dados e atribuições obrigatórias

| Fonte | Uso | Licença ou condição | Onde atribuir |
|---|---|---|---|
| OpenStreetMap | Trilhas, pontos de interesse, áreas protegidas | ODbL: "© OpenStreetMap contributors" + link; base derivada também sob ODbL | Mapa (canto), rodapé, Termos, README |
| Tiles do mapa (OSM ou OpenTopoMap) | Fundo do mapa | Política de uso de cada provedor | Mapa |
| Open-Meteo / Copernicus DEM | Elevação | Atribuição a Copernicus e Open-Meteo | Página da trilha, README |
| Wikipedia (pt) | Corpus do RAG | CC BY-SA, com atribuição e link | Fontes da resposta do assistente, README |

**Proibido:** copiar dados do Wikiloc, AllTrails ou similares (os termos de uso não permitem).
