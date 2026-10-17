# Plano do projeto

> Última atualização: 2026-10-17 — nova divisão de módulos e de pessoas.
> Se algo aqui contradiz o [subject](subject.md), o subject vence.

## O produto

**Trilhas SP** *(nome provisório)*: uma plataforma de trilhas para São Paulo e arredores, inspirada no Wikiloc. O usuário encontra trilhas (catálogo inicial vindo do OpenStreetMap), vê o percurso no mapa, registra as trilhas que fez, ganha XP e emblemas, conversa com amigos em tempo real e tira dúvidas com um assistente de IA que conhece as trilhas da região. Funciona como app instalável (PWA), inclusive offline para trilhas já vistas.

**Dentro do escopo:**
- Catálogo de trilhas: lista, mapa, página da trilha, registrar atividade.
- Conta: cadastro, login com e-mail e senha, OAuth, 2FA, perfil e avatar, privacidade de dados (GDPR).
- Social: amigos, status online, chat 1:1, notificações em tempo real.
- Assistente: perguntas sobre trilhas com fontes (RAG) e planejador de trilha (LLM).
- Gamificação: XP e níveis, emblemas e ranking.
- PWA e design system próprio.
- Páginas de Privacidade e Termos (obrigatórias).

**Adiado** (o schema já tem as tabelas `Community`, `Event` e `Post`; não apague, mas não construa agora): comunidades, eventos e posts.

**Fora:** microsserviços, monitoramento (Prometheus/Grafana), busca avançada como módulo, sistema genérico de upload, gravação de GPS ao vivo, app nativo.

## Quem faz o quê

Visão em uma imagem: [diagramas/divisao.png](diagramas/divisao.png).

| Pessoa | Área | Módulos | Pts |
|---|---|---|---|
| **Juh** | Frontend e design system | Framework de frontend · PWA · Design system | 3 |
| **Gabs** | Backend e banco | Framework de backend · ORM · *Exportação/importação (opcional)* · *Dashboard (opcional)* | 2 + 3 opcionais |
| **Di** | Usuários e segurança | Gerenciamento de usuários · OAuth · GDPR · 2FA | 5 |
| **Rafa** | Social e tempo real | Interação entre usuários · Tempo real · Notificações | 5 |
| **Edu** | IA e complementos | Interface de LLM · RAG · Gamificação | 5 |

O detalhe de cada módulo (o que o subject exige, como vamos atender, como demonstrar) está em [MODULOS.md](MODULOS.md), uma seção por pessoa.

Além dos módulos:
- **Juh** apoia as telas de todo mundo e faz o layout base (cabeçalho, rodapé, navegação).
- **Gabs** cuida de nginx + HTTPS (obrigatório), Docker e Makefile, e revisa toda mudança no schema do banco.
- **Di** entrega primeiro o `requireUser()`, porque todos precisam dele.
- **Rafa** entrega cedo o `notify()`, porque toda ação de criar, editar ou excluir precisa chamá-lo.

## Pontuação

| # | Módulo | Tipo | Pts | Dono |
|---|---|---|---|---|
| 1 | Framework de frontend (Next.js) | Minor | 1 | Juh |
| 2 | Framework de backend (Next.js) | Minor | 1 | Gabs |
| 3 | ORM (Prisma) | Minor | 1 | Gabs |
| 4 | Gerenciamento padrão de usuários | Major | 2 | Di |
| 5 | Interação entre usuários (chat, perfil, amigos) | Major | 2 | Rafa |
| 6 | Recursos em tempo real (WebSockets) | Major | 2 | Rafa |
| 7 | Interface de LLM | Major | 2 | Edu |
| 8 | Sistema RAG | Major | 2 | Edu |
| 9 | PWA com suporte offline e instalação | Minor | 1 | Juh |
| 10 | Autenticação via OAuth 2.0 | Minor | 1 | Di |
| 11 | Sistema de gamificação | Minor | 1 | Edu |
| 12 | Conformidade com GDPR | Minor | 1 | Di |
| 13 | Sistema completo de notificações | Minor | 1 | Rafa |
| 14 | Autenticação de dois fatores (2FA) | Minor | 1 | Di |
| 15 | Design system próprio | Minor | 1 | Juh |
| | **Subtotal** | | **20** | |
| 16 | Exportação e importação de dados *(opcional)* | Minor | 1 | Gabs |
| 17 | Dashboard de análise com visualização de dados *(opcional)* | Major | 2 | Gabs |
| | **Total com opcionais** | | **23** | |

O mínimo é 14. Módulo incompleto vale 0, então 100% de um módulo vale mais que 80% de dois.

## Em aberto

| O quê | Por que importa | Pode esperar? |
|---|---|---|
| **Dono do catálogo de trilhas** (lista, mapa, página da trilha, registrar atividade) | Nenhum módulo cobre o catálogo, mas RAG, gamificação, dashboard, exportação, PWA offline e boa parte das notificações dependem de trilhas e atividades. Detalhes em [MODULOS.md](MODULOS.md#catálogo-de-trilhas-sem-dono) | **Não.** Pelo menos a API de atividades e a página da trilha precisam sair cedo |
| **Dono das páginas de Privacidade e Termos** | Sem elas o projeto é **reprovado**. Conteúdo mínimo em [AVALIACAO.md](AVALIACAO.md#privacidade-e-termos) | Sim: dá para fazer no fim, quando as funcionalidades estiverem definidas. O link no rodapé entra já no layout |
| **Papéis PO, PM e Tech Lead** | O subject exige que estejam no README | Sim, mas precisam estar definidos antes da avaliação |
| Decisões técnicas pendentes | Tempo real, HTTPS × PWA, e-mail, provedor de LLM | Ver [decisoes/](decisoes/README.md) |

## O que destrava os outros

Sem datas, mas com ordem. Estes itens bloqueiam outras pessoas e vêm primeiro:

1. `requireUser()` e telas de login e cadastro (Di).
2. Tokens de cor e tipografia, componentes básicos e layout com rodapé (Juh).
3. nginx com HTTPS e um certificado que não quebre o PWA (Gabs, testando com a Juh).
4. Decisão de como o WebSocket roda + `notify()` (Rafa, com o Gabs).
5. Dados de trilhas utilizáveis + API de atividades (catálogo, sem dono).

## Riscos principais

1. **Erro ou warning no console do Chrome reprova o projeto.** Causas comuns em [TECNICO.md](TECNICO.md#console-limpo).
2. **PWA × certificado autoassinado:** o Chrome não registra service worker em página com erro de certificado. Testar no começo.
3. **"Notificações para todas as ações"** é fácil de esquecer. A lista de ações está em [MODULOS.md](MODULOS.md#ações-que-geram-notificação), e cada dono acrescenta as suas.
4. **Catálogo de trilhas ruim:** hoje 94% das trilhas importadas têm menos de 500 m e muitas são vielas urbanas. Afeta a demo, o RAG e a gamificação. Ver [dados-trilhas.md](dados-trilhas.md).
5. **GDPR × Exportação:** se o mesmo "exportar meus dados" for usado nos dois módulos, o avaliador pode contar um só. Precisam ser funcionalidades diferentes.
6. **Design system "próprio":** copiar componentes prontos (shadcn/ui) pode não convencer o avaliador. Ver [MODULOS.md](MODULOS.md#15-design-system-próprio-minor).
7. **Todo mundo precisa explicar e modificar o próprio código ao vivo** na avaliação. Escreva você mesmo a lógica central do seu módulo.
8. **Commits de todos, com mensagens claras.** O subject verifica. Nada de `wip`.
