# Módulos da avaliação

> Última atualização: 2026-10-01 — lista inicial (substitui o antigo `modulos_escolhidos.md`).
> Donos: PO (visão geral) + dono de cada frente (status e evidências). O status vivo de cada módulo está em [STATUS.md](STATUS.md#módulos).

Regras do subject que guiam este documento:
- Mínimo de **14 pontos** (Major = 2, Minor = 1).
- **Módulo incompleto ou que não funciona vale 0.** Ou seja: 100% de um módulo vale mais que 80% de dois.
- O avaliador pede para **demonstrar** cada módulo. Por isso cada um tem uma seção "Como demonstrar".

## 1. Pontuação

| # | Módulo | Tipo | Pts | Frente | Camada |
|---|---|---|---|---|---|
| 1 | Framework de frontend (Next.js) | Minor | 1 | Todas (F1 configura) | Núcleo |
| 2 | Framework de backend (Next.js) | Minor | 1 | Todas (F1 configura) | Núcleo |
| 3 | ORM (Prisma) | Minor | 1 | Todas (F1 configura) | Núcleo |
| 4 | Gerenciamento padrão de usuários | Major | 2 | F2 (+ F3: amigos e online) | Núcleo |
| 5 | Interação entre usuários (chat, perfil, amigos) | Major | 2 | F3 (+ F2: perfil) | Núcleo |
| 6 | Recursos em tempo real (WebSockets) | Major | 2 | F3 | Núcleo |
| 7 | Backend em microsserviços | Major | 2 | F1 (+ todas) | Núcleo |
| 8 | Busca avançada | Minor | 1 | F4 | Núcleo |
| 9 | Upload e gestão de arquivos | Minor | 1 | F2 | Núcleo |
| 10 | Sistema de notificações | Minor | 1 | F3 (+ todas) | Núcleo |
| 11 | Interface de LLM | Major | 2 | F5 | Margem |
| 12 | Sistema RAG | Major | 2 | F5 | Margem |
| 13 | Monitoramento (Prometheus + Grafana) | Major | 2 | F1 | Margem |
| 14 | Health check, status page e backups | Minor | 1 | F1 | Margem |
| | **Total** | | **21** | | |

- **Núcleo (14 pts):** sozinho já atinge o mínimo. É prioridade máxima até o marco M2.
- **Margem (7 pts):** protege contra módulos não validados (o subject recomenda passar de 14). Começa em paralelo, já que as frentes F1 e F5 têm donos dedicados.
- **Sobre os frameworks (itens 1 e 2):** o subject diz que frameworks full-stack como Next.js "contam como ambos se você usar as capacidades de frontend e backend". Os dois Minors valem 2 pontos, o mesmo que o Major "Use a framework for both the frontend and backend". **Recomendação: declarar no README como o Major**, que descreve exatamente o caso do Next.js e evita discussão. Em qualquer caso, o `web` precisa **usar de verdade** o backend do Next.js (Route Handlers, Server Actions, acesso a dados no servidor), e não ser só uma casca que chama microsserviços.

## 2. Critérios de aceite e demonstração

Formato de cada módulo: **Requisito** (do subject) → **Como atendemos** → **Critérios de aceite** (checklist para dar "pronto") → **Como demonstrar** → **Risco**.

### 1–2. Frameworks: Next.js (frontend + backend)
- **Como atendemos:** `apps/web` com App Router (React) para a UI; Route Handlers, Server Actions e Server Components com acesso ao banco para o backend.
- **Critérios:** [ ] páginas em React/Next.js · [ ] lógica de backend real no Next.js (auth, perfis, amigos, comunidades, arquivos) · [ ] README explica o que é frontend e o que é backend no Next.js.
- **Demonstrar:** mostrar uma Server Action (ex.: criar comentário) e um Route Handler (ex.: upload) no código.
- **Risco:** baixo.

### 3. ORM: Prisma
- **Como atendemos:** Prisma em todos os serviços com banco; schemas versionados; migrations.
- **Critérios:** [ ] todo acesso a dados via Prisma, exceto consultas espaciais e vetoriais (`$queryRaw` com justificativa) · [ ] migrations versionadas · [ ] schema claro com relações (exigência da parte obrigatória).
- **Demonstrar:** arquivos `.prisma`, uma migration, uma query com relações.
- **Risco:** baixo. Explicar por que há SQL puro para PostGIS e pgvector (o ORM não suporta esses tipos).

### 4. Gerenciamento padrão de usuários (Major)
- **Requisito:** atualizar informações do perfil; upload de avatar com padrão se não houver; adicionar amigos e ver o status online; página de perfil com as informações.
- **Como atendemos:** F2 (edição de perfil, avatar via sistema de upload, avatar padrão gerado), F3 (amizades, presença via `realtime`).
- **Critérios:** [ ] editar nome, bio e cidade com validação front e back · [ ] avatar com preview; usuário sem avatar exibe um padrão · [ ] enviar, aceitar, recusar e remover amizade · [ ] status online/offline dos amigos **atualiza em tempo real** e funciona com várias abas abertas · [ ] página `/u/[username]` com informações e estatísticas.
- **Demonstrar:** dois navegadores (normal e anônimo); fechar a aba de um → o outro vê "offline".
- **Risco:** médio. Presença com várias abas e reconexão.

### 5. Interação entre usuários (Major)
- **Requisito:** chat básico (enviar e receber mensagens); sistema de perfis (ver informações); sistema de amigos (adicionar, remover, listar).
- **Como atendemos:** chat 1:1 entre amigos no `realtime` com histórico persistido; perfil (F2); amigos (F3).
- **Critérios:** [ ] enviar e receber mensagens em tempo real · [ ] histórico persistido e paginado · [ ] lista de conversas com não lidas · [ ] ver perfil a partir do chat e da lista de amigos · [ ] adicionar, remover e listar amigos.
- **Demonstrar:** conversa entre dois usuários; recarregar a página → o histórico continua lá.
- **Risco:** baixo/médio.

### 6. Recursos em tempo real (Major)
- **Requisito:** atualizações em tempo real entre clientes; lidar bem com conexão e desconexão; broadcast eficiente.
- **Como atendemos:** Socket.IO no `realtime`, com salas por usuário (`user:<id>`) e por comunidade (`community:<id>`); chat, presença, notificações e feed de comunidade.
- **Critérios:** [ ] eventos chegam só a quem interessa (salas, nunca broadcast global) · [ ] reconexão automática com aviso "reconectando…" na UI · [ ] após reconectar, o cliente ressincroniza o que perdeu (mensagens e notificações desde o último timestamp) · [ ] desconexão atualiza a presença · [ ] sem erros no console ao perder a conexão (além do aviso de rede do próprio navegador).
- **Demonstrar:** derrubar o container `realtime` → banner de reconexão → subir de novo → volta sozinho e sincroniza.
- **Risco:** médio. WSS atrás do nginx e autenticação no handshake (validar no M0).

### 7. Backend em microsserviços (Major)
- **Requisito:** serviços pouco acoplados com interfaces claras; REST ou filas de mensagens; responsabilidade única por serviço.
- **Como atendemos:** `web` (domínio principal + BFF), `realtime`, `trails`, `ai`; cada um com container e banco próprios; contratos em `packages/contracts`; REST interno + eventos via Redis pub/sub.
- **Critérios:** [ ] cada serviço tem responsabilidade única documentada · [ ] nenhum serviço acessa o banco de outro (usuários de banco separados) · [ ] contratos versionados e documentados · [ ] comunicação via REST **e** mensagens · [ ] falha de um serviço não derruba os outros (degradação controlada).
- **Demonstrar:** diagrama da [ARCHITECTURE.md](ARCHITECTURE.md); `docker compose stop ai` → o app continua funcionando, o assistente mostra "indisponível" e a status page fica "degradado".
- **Risco:** **alto (interpretação).** Um avaliador pode ver o `web` como "monólito". Defesa: [ADR-0001](adr/0001-arquitetura-servicos.md), banco por serviço, contratos e demo de isolamento de falha. A camada de margem existe por isso.

### 8. Busca avançada (Minor)
- **Requisito:** busca com filtros, ordenação e paginação.
- **Como atendemos:** busca de trilhas no `trails`, com texto (trigram), dificuldade, faixa de distância, faixa de desnível, tipo (circular/linear), município, raio a partir de um ponto e área visível do mapa; ordenação por relevância, distância, desnível, nome e proximidade; paginação com total. Busca de comunidades mais simples.
- **Critérios:** [ ] ao menos 4 filtros combináveis · [ ] ao menos 3 ordenações · [ ] paginação com total e navegação · [ ] estado na URL (compartilhável, funciona com voltar/avançar) · [ ] validação dos parâmetros no back · [ ] estado vazio amigável.
- **Demonstrar:** combinar filtros, trocar a ordenação, ir para a página 2, copiar a URL para outra aba.
- **Risco:** baixo.

### 9. Upload e gestão de arquivos (Minor)
- **Requisito:** vários tipos de arquivo; validação no cliente e no servidor (tipo, tamanho, formato); armazenamento seguro com controle de acesso; preview; indicador de progresso; exclusão.
- **Como atendemos:** sistema genérico de arquivos no `web`: imagens (JPEG, PNG, WebP), PDF e GPX; usado por avatar, anexos de posts e GPX de trilhas realizadas.
- **Critérios:** [ ] validação no cliente (`accept`, tamanho) e no servidor (magic bytes, tamanho, GPX com XML válido) · [ ] arquivos fora da pasta pública, com nome aleatório · [ ] download só com permissão (dono, público ou membro da comunidade) · [ ] preview de imagem, PDF e GPX (trilha no mapa) · [ ] barra de progresso real (XHR) · [ ] excluir remove o arquivo e o registro · [ ] EXIF removido das imagens.
- **Demonstrar:** upload de imagem grande com barra de progresso; tentar enviar `.exe` renomeado para `.png` → recusado; anexo de comunidade privada inacessível para quem não é membro.
- **Risco:** médio (segurança).

### 10. Sistema de notificações (Minor)
- **Requisito:** sistema completo de notificações para **todas** as ações de criação, atualização e exclusão.
- **Como atendemos:** produtores publicam `notification.requested`; o `realtime` persiste e entrega em tempo real; há um sino com contador e uma página de notificações. A **matriz de notificações** em [frentes/social/README.md](frentes/social/README.md#matriz-de-notificações) lista cada ação CRUD e quem é notificado.
- **Critérios:** [ ] toda ação CRUD da matriz gera notificação (testado item a item) · [ ] persistida (aparece depois de recarregar) · [ ] chega em tempo real · [ ] marcar como lida, individualmente e todas · [ ] contador de não lidas · [ ] quem fez a ação recebe feedback imediato (toast).
- **Demonstrar:** percorrer a matriz com dois usuários.
- **Risco:** **médio/alto (escopo).** "Todas" é amplo; a matriz precisa existir desde o primeiro dia e o checklist de PR cobra isso.

### 11. Interface de LLM (Major)
- **Requisito:** gerar texto e/ou imagens a partir da entrada do usuário; tratar respostas em streaming; tratamento de erros e rate limiting.
- **Como atendemos:** **Planejador de trilha**: o usuário escolhe a trilha e informa data, experiência do grupo e tempo disponível; o LLM gera um plano (horários, ritmo, checklist de equipamentos, alertas) em streaming.
- **Critérios:** [ ] texto gerado a partir da entrada do usuário · [ ] streaming token a token na UI, com botão de parar · [ ] erros do provedor (timeout, 5xx, chave inválida) viram mensagem amigável sem quebrar a página · [ ] rate limit por usuário (ex.: 10/min e 50/dia) com resposta 429 e aviso na UI · [ ] entradas validadas e limitadas em tamanho.
- **Demonstrar:** gerar um plano; estourar o rate limit; simular a falha do provedor (chave inválida).
- **Risco:** médio (custo e cota no dia da avaliação).

### 12. Sistema RAG (Major)
- **Requisito:** interagir com um grande conjunto de dados; perguntas com respostas relevantes; recuperação de contexto e geração de resposta.
- **Como atendemos:** **Pergunte sobre as trilhas**: corpus com as trilhas do catálogo, pontos de interesse, artigos da Wikipedia sobre parques e picos e guias de segurança curados. Embeddings no pgvector, busca top-k, resposta com **fontes citadas**.
- **Critérios:** [ ] corpus com **≥ 2.000 trechos**, com a contagem visível · [ ] pipeline de ingestão reexecutável (reindexa quando o catálogo muda) · [ ] resposta cita as fontes usadas · [ ] responde "não sei" quando o contexto não cobre a pergunta · [ ] conjunto de 20 perguntas de avaliação com resultados registrados.
- **Demonstrar:** pergunta específica ("trilha com cachoeira em Mairiporã até 5 km?") → resposta com fontes; pergunta fora do escopo → recusa educada.
- **Risco:** médio. "Grande conjunto de dados" é subjetivo, e é preciso **diferenciar claramente do módulo 11**: são telas, endpoints e capacidades diferentes.

### 13. Monitoramento: Prometheus + Grafana (Major)
- **Requisito:** Prometheus coletando métricas; exporters e integrações; dashboards customizados no Grafana; regras de alerta; acesso seguro ao Grafana.
- **Como atendemos:** `/metrics` em todos os serviços; exporters de node, cAdvisor, Postgres, Redis e nginx; dashboards provisionados; regras no Prometheus + Alertmanager → Discord; Grafana com login via HTTPS.
- **Critérios:** [ ] todos os targets "UP" no Prometheus · [ ] ≥ 3 dashboards customizados (serviços RED, infraestrutura, negócio: tempo real e IA) · [ ] ≥ 4 regras de alerta, sendo ao menos uma demonstrável ao vivo · [ ] Grafana sem acesso anônimo, com senha do `.env` e atrás de HTTPS.
- **Demonstrar:** dashboards com tráfego real; parar um serviço → alerta disparando.
- **Risco:** baixo/médio (muita configuração, pouca lógica).

### 14. Health check, status page e backups (Minor)
- **Requisito:** health checks; status page; backups automatizados; procedimentos de recuperação de desastre.
- **Como atendemos:** `/health` e `/ready` em todos os serviços + healthchecks do compose; `/status` público; container de backup com retenção; `make restore`; runbook de DR.
- **Critérios:** [ ] healthchecks no compose com `depends_on: service_healthy` · [ ] status page mostra cada componente e o último backup · [ ] backups automáticos com retenção configurável · [ ] restauração testada (registro do último teste no runbook) · [ ] runbook com cenários, RPO e RTO.
- **Demonstrar:** listar backups; apagar dados de teste; restaurar; mostrar a status page antes e depois.
- **Risco:** baixo.

## 3. Módulos reserva

Só começam **depois do marco M2** (núcleo completo), se sobrar tempo. Ordenados por custo-benefício:

| Módulo | Tipo | Pts | Esforço | Por que é barato aqui |
|---|---|---|---|---|
| OAuth 2.0 remoto (42 e/ou GitHub) | Minor | 1 | Baixo | O Better Auth tem provedores prontos; login com a conta da 42 é um bom toque local |
| 2FA (TOTP) | Minor | 1 | Baixo | Plugin pronto no Better Auth |
| Sistema de organizações | Major | 2 | Baixo/médio | As **comunidades já são organizações**: criar, editar e excluir; adicionar e remover membros; ações dentro delas. Faltaria o dono adicionar e remover membros diretamente |
| Gamificação | Minor | 1 | Médio | Emblemas, XP e leaderboard a partir das trilhas realizadas (já previsto como "futuramente") |

## 4. Matriz módulo × frente

| Módulo | F1 Plataforma | F2 Identidade | F3 Social | F4 Trilhas | F5 IA |
|---|---|---|---|---|---|
| Frameworks, ORM | ● configura | ○ usa | ○ usa | ○ usa | ○ usa |
| Gerenciamento de usuários | | ● perfil, avatar | ● amigos, online | | |
| Interação entre usuários | | ○ perfil | ● chat, amigos | | |
| Tempo real | | | ● | ○ | |
| Microsserviços | ● | ○ | ○ realtime | ○ trails | ○ ai |
| Busca avançada | | ○ comunidades | | ● | |
| Upload de arquivos | | ● | | ○ GPX | |
| Notificações | | ○ produz | ● | ○ produz | |
| LLM, RAG | | | | ○ dados | ● |
| Monitoramento, health e backups | ● | ○ métricas | ○ métricas | ○ métricas | ○ métricas |

● dono · ○ contribui
