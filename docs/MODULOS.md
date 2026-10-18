# Módulos

> Última atualização: 2026-10-17 — nova divisão de módulos.
> **Como usar:** cada pessoa cuida da própria seção. As caixas são o status do módulo: **marque no mesmo PR que entrega o item.** Os requisitos marcados com 📜 são citados do [subject](subject.md); o resto é como o time decidiu atender.

Regras que valem para todo módulo:
- O avaliador pede para **demonstrar** cada módulo. Módulo incompleto vale 0.
- Toda entrada de formulário é validada no front **e** no back (zod).
- Toda ação de criar, editar ou excluir gera notificação ([lista](#ações-que-geram-notificação)).
- Nenhum erro ou warning no console do Chrome.

Sumário: [Juh](#juh--frontend-e-design-system) · [Gabs](#gabs--backend-e-banco) · [Di](#di--usuários-e-segurança) · [Rafa](#rafa--social-e-tempo-real) · [Edu](#edu--ia-e-complementos) · [Catálogo de trilhas (sem dono)](#catálogo-de-trilhas-sem-dono) · [Ações que geram notificação](#ações-que-geram-notificação)

---

## Juh — Frontend e design system

Também com a Juh: layout base (cabeçalho, rodapé com links para `/privacidade` e `/termos`, navegação), responsividade e acessibilidade (obrigatórias), apoio às telas das outras áreas.

### 1. Framework de frontend (Minor)
- [ ] 📜 Usar um framework de frontend → Next.js 16 (App Router, React 19)
- [ ] Todas as páginas em React/Next.js; Client Components (`"use client"`) só onde há interatividade
- [ ] README explica o que é frontend no Next.js

**Demonstrar:** uma página Server Component e um Client Component, explicando a diferença.
**Já existe:** Next.js rodando no container; só as páginas `/` e `/login`, sem estilo.

### 9. PWA com suporte offline e instalação (Minor)
- [ ] 📜 Progressive Web App com suporte offline
- [ ] 📜 Instalável
- [ ] Manifest (nome, ícones, cores) e service worker, sem erro no console
- [ ] Offline: o app abre, as trilhas já visitadas aparecem, e o que não está em cache mostra uma página "você está offline" amigável
- [ ] Funciona atrás do HTTPS do projeto

**Como:** o guia de PWA da documentação do Next.js (`app/manifest.ts` + service worker), ou uma biblioteca como Serwist. Confirme a compatibilidade com o Next 16 antes de escolher.
**Demonstrar:** instalar pelo Chrome; DevTools → Network → Offline → recarregar a página de uma trilha já vista.
**Depende de:** Gabs (HTTPS). ⚠️ O Chrome não registra service worker em página com erro de certificado. Testar com o Gabs assim que o nginx existir.
**Atenção ao mapa:** a política dos tiles do OSM proíbe baixar tiles antecipadamente para uso offline ([dados-trilhas.md](dados-trilhas.md#mapa-e-licenças)). Offline, o percurso da trilha pode aparecer sem o mapa de fundo.

### 15. Design system próprio (Minor)
- [ ] 📜 Paleta de cores
- [ ] 📜 Tipografia
- [ ] 📜 Ícones
- [ ] 📜 Pelo menos 10 componentes reutilizáveis
- [ ] Tokens (cores, tipografia, espaçamento) no tema do Tailwind 4, usados por todas as telas
- [ ] Cada componente com estados (hover, foco visível, desabilitado, erro) e acessível pelo teclado
- [ ] Página `/design` que mostra a paleta, a tipografia, os ícones e todos os componentes (é o que se mostra ao avaliador)

**Sugestão de componentes:** Button, Input, Textarea, Select, Card, Dialog, Avatar, Badge, Toast, Tabs, Skeleton, EmptyState.
**Atenção:** o subject diz *custom-made*. Copiar os componentes do shadcn/ui pode não convencer o avaliador. Escreva os componentes; para comportamento acessível difícil (Dialog, Select), dá para usar primitivas sem estilo como Radix e documentar.
**Prioridade:** os componentes básicos e o layout saem primeiro, porque todas as telas usam.
**Já existe:** Tailwind instalado, ainda não configurado.

---

## Gabs — Backend e banco

Também com o Gabs: **nginx + HTTPS** (obrigatório: só o nginx expõe porta; HTTP redireciona para HTTPS), Docker e Makefile, e a revisão de toda mudança no `schema.prisma`.

### 2. Framework de backend (Minor)
- [x] 📜 Usar um framework de backend → Next.js (Route Handlers e Server Actions)
- [ ] Lógica de backend real no Next.js: auth, perfis, amigos, trilhas, atividades, notificações
- [ ] README explica o que é backend no Next.js

**Demonstrar:** um Route Handler e uma Server Action no código, com validação e tratamento de erro.
**Já existe:** `GET /api/health` (checa o banco), rotas do Better Auth, os helpers de [`src/server/api/`](../apps/web/src/server/api/) (erros padrão, `withHandler`, `withAction`, validação, paginação), `GET /api/trails` e `/api/trails/[id]` e as server actions de trilhas e atividades.

### 3. ORM (Minor)
- [x] 📜 Usar um ORM → Prisma 7 com PostgreSQL
- [ ] Schema com relações claras (também é exigência obrigatória) e diagrama no README
- [x] Migrations versionadas, aplicadas no start do container
- [ ] Todo acesso a dados via Prisma, exceto busca vetorial (`$queryRaw` com template tag, justificado)

**Demonstrar:** o `schema.prisma`, uma migration e uma query com relações.
**Já existe:** [`schema.prisma`](../apps/web/prisma/schema.prisma), 4 migrations, cliente em `src/lib/db.ts`, importação das trilhas do OSM, testes de integração com banco real (`make test`).

### 16. Exportação e importação de dados (Minor, opcional)
- [ ] 📜 Exportar dados em vários formatos (JSON, CSV, XML…)
- [ ] 📜 Importar dados com validação
- [ ] 📜 Operações em lote

**Sugestão:** exportar e importar **trilhas e atividades**: JSON, CSV e GPX (que é XML). Importação em lote de vários GPX/CSV, com validação e relatório do que falhou.
**Atenção:** precisa ser diferente do "baixar meus dados" do GDPR (Di), senão o avaliador pode contar um módulo só.
**Depende de:** catálogo de trilhas (atividades).

### 17. Dashboard de análise com visualização de dados (Major, opcional)
- [ ] 📜 Gráficos interativos (linha, barra, pizza…)
- [ ] 📜 Dados atualizados em tempo real
- [ ] 📜 Exportação (PDF, CSV…)
- [ ] 📜 Intervalo de datas e filtros customizáveis

**Sugestão:** painel de atividades do usuário (km por semana, por dificuldade, evolução de XP) e uma visão geral do app. A Juh pode ajudar na interface.
**Depende de:** catálogo de trilhas (atividades) e Rafa (tempo real).

---

## Di — Usuários e segurança

Também com a Di: cadastro e login com e-mail e senha (obrigatório), `getSession()` e `requireUser()` (todos usam; sai primeiro) e o envio de e-mails.

### 4. Gerenciamento padrão de usuários (Major)
- [ ] 📜 O usuário atualiza as informações do perfil
- [ ] 📜 O usuário envia um avatar, com um avatar padrão se não enviar
- [ ] 📜 Adicionar outros usuários como amigos e ver o status online deles → **vem do Rafa** (módulos 5 e 6); a Di integra na página de perfil
- [ ] 📜 Página de perfil com as informações do usuário
- [ ] Upload do avatar validado pelo conteúdo (não pela extensão), com tamanho limitado, salvo fora da pasta pública e servido por uma rota

**Demonstrar:** editar o perfil, enviar um avatar, ver o avatar padrão num usuário novo, ver um amigo ficar online e offline na página de perfil.
**Já existe:** Better Auth com rotas `/api/auth/*`, rate limit no login (5/min) e no cadastro (3/min) e um [script de teste](../apps/web/scripts/test-auth.sh). Faltam as telas, o `requireUser()` e o perfil.

### 10. Autenticação via OAuth 2.0 (Minor)
- [ ] 📜 Login remoto com OAuth 2.0 (Google, GitHub, 42…)
- [ ] Conta OAuth com o mesmo e-mail de uma conta existente: comportamento definido (vincular ou recusar com mensagem clara)
- [ ] Credenciais do provedor fora do git

**Como:** o Better Auth tem provedores prontos (GitHub, Google). Para a 42, o plugin de OAuth genérico; confirme na documentação da versão instalada.
**Demonstrar:** entrar com GitHub ou 42; ver a conta vinculada no perfil.

### 12. Conformidade com GDPR (Minor)
- [ ] 📜 O usuário pode pedir os próprios dados
- [ ] 📜 Exclusão de dados com confirmação
- [ ] 📜 Exportar os dados do usuário em formato legível
- [ ] 📜 E-mails de confirmação para as operações com dados
- [ ] A exclusão apaga mesmo (o schema já apaga em cascata) e encerra as sessões

**Como:** página "Privacidade e dados" nas configurações. Em dev, um servidor de e-mail falso como o Mailpit no compose mostra os e-mails numa página, o que também serve para a demo.
**Demonstrar:** pedir os dados → e-mail de confirmação → baixar o arquivo legível; excluir a conta → confirmação → login não funciona mais.
**Depende de:** Gabs (saber quais tabelas têm dados pessoais).

### 14. Autenticação de dois fatores (Minor)
- [ ] 📜 Sistema completo de 2FA
- [ ] Ativar (QR code para app autenticador), desativar e códigos de recuperação
- [ ] Login pede o código quando o 2FA está ativo

**Como:** plugin de 2FA do Better Auth (TOTP + códigos de recuperação).
**Demonstrar:** ativar com o Google Authenticator, sair, entrar de novo pedindo o código, usar um código de recuperação.

---

## Rafa — Social e tempo real

Também com o Rafa: decidir com o Gabs **como o WebSocket roda** ([decisões](decisoes/README.md)) e entregar cedo o `notify()`, que todo mundo chama.

### 5. Interação entre usuários (Major)
- [ ] 📜 Chat básico: enviar e receber mensagens entre usuários
- [ ] 📜 Sistema de perfil: ver as informações de um usuário → página da Di, aberta a partir do chat e da lista de amigos
- [ ] 📜 Sistema de amigos: adicionar, remover, ver a lista de amigos
- [ ] Pedido de amizade com aceitar e recusar; pedidos cruzados (A→B e B→A ao mesmo tempo) viram **uma** amizade
- [ ] Histórico do chat salvo no banco (recarregar a página não perde nada)

**Demonstrar:** dois navegadores (normal e anônimo): pedido de amizade → aceitar → conversar → recarregar e o histórico continua.
**Já existe:** nada. `Friendship` e as tabelas do chat ainda não estão no schema.

### 6. Recursos em tempo real (Major)
- [ ] 📜 Atualizações em tempo real entre clientes
- [ ] 📜 Lidar bem com conexão e desconexão
- [ ] 📜 Broadcast eficiente (salas por usuário, nunca enviar para todos)
- [ ] O socket só conecta depois do login (senão aparece erro no console)
- [ ] Status online com várias abas: fechar uma aba não deixa o usuário offline
- [ ] Ao reconectar, o cliente recupera o que perdeu

**Demonstrar:** derrubar o processo do socket → aviso "reconectando…" → volta sozinho e sincroniza.

### 13. Sistema completo de notificações (Minor)
- [ ] 📜 Notificações para **todas** as ações de criação, atualização e exclusão
- [ ] Helper `notify()` que grava em `Notification` e entrega em tempo real
- [ ] Sino com contador de não lidas, página de notificações, marcar como lida (uma e todas)
- [ ] Todas as linhas da [lista de ações](#ações-que-geram-notificação) conferidas com dois usuários

**Já existe:** a tabela `Notification` (só `message` e `isRead`; deve precisar de `type` e `link`).

---

## Edu — IA e complementos

### 7. Interface de LLM (Major)
- [ ] 📜 Gerar texto e/ou imagens a partir da entrada do usuário
- [ ] 📜 Tratar respostas em streaming
- [ ] 📜 Tratamento de erros e rate limiting
- [ ] Botão de parar; erro do provedor vira mensagem amigável sem quebrar a página; 429 com aviso na tela

**Como:** **planejador de trilha**: o usuário escolhe a trilha, a data, a experiência do grupo e o tempo disponível; o LLM gera o plano (horários, ritmo, equipamentos, alertas) em streaming.
**Demonstrar:** gerar um plano, parar no meio, estourar o rate limit, simular o provedor fora do ar.

### 8. Sistema RAG (Major)
- [ ] 📜 Interagir com um grande conjunto de dados
- [ ] 📜 O usuário faz perguntas e recebe respostas relevantes
- [ ] 📜 Recuperação de contexto e geração da resposta
- [ ] Resposta cita as fontes; diz "não encontrei" quando o contexto não cobre a pergunta
- [ ] Corpus com tamanho visível na tela (meta: 2.000 trechos ou mais)

**Como:** "Pergunte sobre as trilhas". O corpus reúne as trilhas do catálogo, artigos da Wikipedia sobre parques e picos e guias de segurança escritos pelo time. Embeddings no pgvector (já instalado no banco). Tela e endpoint **separados** do planejador: são dois módulos.
**Depende de:** catálogo de trilhas (dados com qualidade).

### 11. Sistema de gamificação (Minor)
- [ ] 📜 Pelo menos 3 de: conquistas, emblemas, ranking, XP/nível, desafios diários, recompensas → **XP e nível, emblemas e ranking**
- [ ] 📜 Persistente (no banco)
- [ ] 📜 Retorno visual (notificações, barras de progresso)
- [ ] 📜 Regras e progressão claras (uma página explica como ganhar XP e cada emblema)

**Já existe:** tabelas `Badge` e `UserBadge`.
**Depende de:** catálogo de trilhas (atividades), Rafa (`notify()`), Juh (barra de progresso, emblemas na interface).

---

## Catálogo de trilhas (sem dono)

Nenhum módulo cobre o catálogo, mas ele é o produto: sem trilhas e atividades não há RAG, gamificação, dashboard, exportação nem PWA offline para mostrar.

**Inclui:**
- [ ] Dados de trilhas utilizáveis (ver o problema abaixo)
- [ ] Lista de trilhas com mapa (Leaflet, só no cliente) e filtros simples
- [ ] Página da trilha: percurso no mapa, distância, desnível, dificuldade, aviso de segurança, atribuição do OpenStreetMap
- [ ] Registrar, editar e excluir uma atividade (trilha feita), com notificação

**Já existe:** [`import-trails.mts`](../apps/web/prisma/import-trails.mts) importa 3.878 trilhas de um SQLite no start do container (idempotente). Backend pronto (Gabs): busca com filtros (`GET /api/trails`), detalhe, server actions de criar, editar e excluir trilhas e atividades, estatísticas de atividades. Faltam as telas e as notificações.

**Problema nos dados:** 94% das trilhas importadas têm menos de 500 m e muitas são vielas urbanas. Um filtro por comprimento e nome deixa cerca de 90 trilhas de verdade. O script que gerou o dataset não está no repo, e a fonte da elevação não está documentada. Números e pendências em [dados-trilhas.md](dados-trilhas.md).

**Sugestão de divisão:** Gabs na API e nos dados (ele fez a importação), Juh nas telas.

---

## Ações que geram notificação

O subject pede notificação para **todas** as ações de criar, editar e excluir. Esta lista define o que "todas" quer dizer no nosso app. **Ação nova = linha nova, no mesmo PR.**

Regra proposta: quem fez a ação vê um toast na hora; se ninguém mais é afetado, a notificação vai para ele mesmo.

| Ação | Quem recebe | Dono | ✔ |
|---|---|---|---|
| Criar conta | o próprio | Di | [ ] |
| Editar perfil, trocar avatar | o próprio | Di | [ ] |
| Ativar ou desativar 2FA; vincular conta OAuth | o próprio | Di | [ ] |
| Pedir os dados; excluir a conta (GDPR) | o próprio (e por e-mail) | Di | [ ] |
| Enviar pedido de amizade | o destinatário | Rafa | [ ] |
| Aceitar ou recusar pedido | quem pediu | Rafa | [ ] |
| Desfazer amizade | o próprio | Rafa | [ ] |
| Mensagem nova (com a conversa fechada) | o destinatário | Rafa | [ ] |
| Registrar, editar ou excluir atividade | o próprio (registrar: também os amigos) | catálogo | [ ] |
| Criar, editar ou excluir trilha | o próprio | catálogo | [ ] |
| Ganhar XP, subir de nível, ganhar emblema | o próprio | Edu | [ ] |
| Importação ou exportação concluída | o próprio | Gabs | [ ] |
