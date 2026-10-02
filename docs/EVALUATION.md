# Preparação para a avaliação

> Última atualização: 2026-10-01 — checklist inicial.
> Dono: PO. Usado intensamente nas semanas 7 e 8 ([ROADMAP.md](ROADMAP.md#2-fases-e-marcos)).

O subject é claro: **se a parte obrigatória falhar, o projeto é rejeitado**, e **módulo que não funciona vale 0**. Este documento existe para não haver surpresa.

## 1. Parte obrigatória (eliminatória)

| ✔ | Requisito (subject) | Como verificar | Responsável |
|---|---|---|---|
| [ ] | Aplicação web com frontend, backend e banco | Arquitetura | Tech Lead |
| [ ] | Git com commits de **todos**, mensagens claras, trabalho distribuído | `git shortlog -sn`; histórico completo no repositório de entrega | PM |
| [ ] | Containerização com **um único comando** | Clone limpo → `.env` → `make` | F1 |
| [ ] | Compatível com a versão estável mais recente do Chrome | Roteiro completo no Chrome atualizado | Todos |
| [ ] | **Nenhum warning ou erro no console** | Teste Playwright de console + navegação manual com o DevTools aberto | Tech Lead |
| [ ] | Política de Privacidade e Termos de Uso **acessíveis** (links no rodapé) e com **conteúdo relevante** (não placeholder) | `/privacidade`, `/termos` (seção 2) | PO |
| [ ] | Vários usuários simultâneos, sem conflitos | 3 navegadores agindo ao mesmo tempo (chat, comunidade, amizade cruzada) | F3 |
| [ ] | Atualizações em tempo real refletidas para todos os usuários conectados | Chat, presença, notificações, feed | F3 |
| [ ] | Sem corrupção de dados nem race conditions | Constraints, transações, idempotência (explicar) | Todos |
| [ ] | Frontend claro, responsivo e acessível | Mobile (DevTools), navegação por teclado, contraste | Todos |
| [ ] | Framework CSS ou solução de estilo | Tailwind + shadcn/ui | — |
| [ ] | Credenciais no `.env` ignorado + `.env.example` | `git ls-files \| grep .env` mostra só o `.env.example` | F1 |
| [ ] | Schema do banco claro, com relações bem definidas | Schemas Prisma + diagrama no README | Tech Lead |
| [ ] | Cadastro e login com e-mail e senha seguros (hash com salt) | Mostrar a configuração do Better Auth e o hash no banco | F2 |
| [ ] | Validação de **todos** os formulários no front **e** no back | Testar enviando dados inválidos pelo DevTools ou curl, ignorando o front | Todos |
| [ ] | **HTTPS em todo lugar** no backend | Só a 443 exposta; 80 redireciona; `docker compose ps` sem outras portas | F1 |
| [ ] | README com todas as seções exigidas (seção 3) | Checklist abaixo | PO |

## 2. Privacidade e Termos: conteúdo mínimo

O subject avisa que **páginas inadequadas reprovam o projeto**. Conteúdo específico do nosso produto:

**Política de Privacidade:** quais dados coletamos (e-mail, nome, username, bio, cidade, avatar, arquivos, mensagens, trilhas realizadas, GPX); para quê; base legal (LGPD); onde ficam armazenados; cookies (só o de sessão); **dados enviados a terceiros** (perguntas ao provedor de LLM; tiles do mapa carregados de servidores externos); quem vê o quê (perfil público, GPX privado, comunidades privadas); retenção e backups; direitos do titular (acesso, correção, exclusão da conta) e como exercê-los; contato.

**Termos de Uso:** quem pode usar; regras de conteúdo (comunidades, chat, uploads proibidos); moderação; **aviso de segurança** (informações de trilha podem estar imprecisas, a atividade envolve riscos e a responsabilidade é do usuário); **IA** (respostas podem conter erros); **atribuições e licenças** (OSM/ODbL, Copernicus/Open-Meteo, Wikipedia/CC BY-SA); limitação de responsabilidade; encerramento de conta; projeto acadêmico da 42.

## 3. README: seções obrigatórias

- [ ] **Primeira linha em itálico:** *This project has been created as part of the 42 curriculum by login1, login2, …*
- [ ] Description (nome, objetivo, visão geral, funcionalidades principais)
- [ ] Instructions (pré-requisitos com versões, `.env`, passo a passo)
- [ ] Resources (referências + **como a IA foi usada**: em quais tarefas e partes)
- [ ] Team Information (papéis e responsabilidades de cada um)
- [ ] Project Management (organização, ferramentas, canais)
- [ ] Technical Stack (front, back, banco e o porquê, outras libs, justificativas)
- [ ] Database Schema (diagrama, tabelas, relações, campos principais)
- [ ] Features List (funcionalidades, **quem fez**, descrição)
- [ ] Modules (lista, pontos, justificativa, implementação, quem fez)
- [ ] Individual Contributions (por pessoa, com desafios e como foram superados), **escrito por cada um**

## 4. Logística do dia

- [ ] Máquina de demonstração testada **no dia anterior**, a partir de um clone limpo do repositório de entrega.
- [ ] `.env` pronto (num local seguro, fora do repo), com a chave de LLM **com saldo** e uma chave reserva.
- [ ] Contas de demonstração criadas (seed de demo) + saber criar uma conta nova na hora.
- [ ] Dois navegadores (ou janela normal + anônima) e um celular ou modo responsivo para mostrar o mobile.
- [ ] Grafana já logado numa aba; senha do Grafana à mão.
- [ ] Um backup recente disponível para a demo de restauração.
- [ ] Plano B se a internet falhar: tudo funciona offline, **exceto** os tiles do mapa e o LLM. Saiba explicar isso.

## 5. Roteiro de demonstração (~30–40 min)

Ordem pensada para contar uma história e passar por todos os módulos. Quem apresenta cada bloco muda em cada ensaio (rodízio).

| # | Bloco | Módulos | Ver |
|---|---|---|---|
| 1 | `make` em clone limpo; containers `healthy`; arquitetura no diagrama | Microsserviços, Health | [F1 §9](frentes/plataforma/README.md#9-como-demonstrar) |
| 2 | HTTPS (aviso do certificado explicado); rodapé → Privacidade e Termos | Obrigatório | seção 2 |
| 3 | Cadastro com erros de validação (front e back) → login | Obrigatório, Ger. de usuários | [F2 §9](frentes/identidade/README.md#9-como-demonstrar) |
| 4 | Home → busca de trilhas com filtros, ordenação, paginação e mapa | Busca, Frameworks | [F4 §9](frentes/trilhas/README.md#9-como-demonstrar) |
| 5 | Detalhe da trilha → marcar como realizada → notificação | Notificações | F4 |
| 6 | Assistente: perguntar (RAG, fontes) e planejar (streaming, parar, rate limit) | RAG, LLM | [F5 §9](frentes/ia/README.md#9-como-demonstrar) |
| 7 | Segundo usuário: amizade, online, chat ao vivo, queda e volta do `realtime` | Interação, Tempo real, Ger. de usuários | [F3 §9](frentes/social/README.md#9-como-demonstrar) |
| 8 | Perfil: editar, avatar com progresso, arquivo inválido recusado, excluir | Ger. de usuários, Upload | F2 |
| 9 | Comunidade privada: pedido, aprovação, post com anexo, feed ao vivo, acesso negado | Notificações, Tempo real, Upload | F2, F3 |
| 10 | Grafana: dashboards; parar um serviço → alerta + status page degradada + app funcionando | Monitoramento, Microsserviços, Health | F1 |
| 11 | Backup → apagar dado → restaurar | Health/Backups | F1 |
| 12 | Tour do código: contratos, schema Prisma, uma Server Action, uma query PostGIS | ORM, Frameworks | — |

## 6. Perguntas prováveis

Treine as respostas em voz alta.

**Sobre o time**
- Como vocês distribuíram os papéis? O que cada um fez? Como se comunicaram? Como dividiram o trabalho?
- Mostre commits seus. Explique uma PR sua.

**Técnicas**
- Por que essa divisão de microsserviços? Por que o `web` faz tanta coisa?
- Como a senha é armazenada? Por que não usar só SHA-256?
- O que acontece se dois usuários se pedirem amizade ao mesmo tempo?
- Como a mensagem chega ao outro usuário? E se ele estiver offline?
- Como vocês garantem que todas as ações geram notificação?
- O que é um embedding? Por que o RAG reduz alucinação? Qual a diferença entre o módulo de LLM e o de RAG?
- Como o desnível é calculado? Por que é uma estimativa?
- O que acontece se o banco cair? E se o serviço de IA cair?
- Como se restaura um backup? Qual é o RPO de vocês?
- Por que o upload valida pelo conteúdo e não pela extensão?

**Modificação ao vivo** (o subject avisa que pode acontecer). Exemplos para treinar:
- Adicionar um campo "telefone de emergência" ao perfil (schema → migration → formulário → validação).
- Mudar o rate limit do assistente de 10 para 5 por minuto.
- Adicionar o filtro "superfície" na busca de trilhas.
- Mudar o texto de uma notificação ou criar uma notificação para uma ação nova.
- Mudar a cor de um componente ou a ordem padrão da busca.
- Adicionar uma nova regra de alerta no Prometheus.
