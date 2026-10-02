# Status do projeto

> Última atualização: 2026-10-01 — plano inicial; nada implementado ainda.
>
> **Como atualizar:** cada dono atualiza a linha da sua frente e dos seus módulos **no PR** que muda o estado. O PM revisa o documento inteiro na reunião semanal.
> **Tarefas individuais não ficam aqui**, ficam no GitHub Projects (motivo em [PROCESS.md](PROCESS.md#onde-fica-cada-informação)). Este arquivo é a visão macro: frentes, módulos, marcos, bloqueios.

Legenda: ⬜ não iniciado · 🟡 em andamento · 🟢 pronto para demo · ✅ validado em ensaio de avaliação · 🔴 bloqueado

## Papéis

Exigidos pelo subject e documentados no README.

| Papel | Pessoa | Responsabilidades |
|---|---|---|
| Product Owner (PO) | *a definir* | Backlog, prioridades, validar entregas, Privacidade e Termos, roteiro da avaliação |
| Project Manager / Scrum Master | *a definir* | Rituais, prazos, bloqueios, riscos, este arquivo |
| Tech Lead / Arquiteto | *a definir* | Arquitetura, ADRs, contratos, qualidade, revisão de PRs críticas |
| Desenvolvedores | Eduardo, Ju, Gabriel, Diego, Rafael | Todos implementam, revisam e documentam |

## Frentes de trabalho

| Frente | Dono | Apoio | Módulos | Status | Próximo marco | Observações |
|---|---|---|---|---|---|---|
| [F1 Plataforma & Observabilidade](frentes/plataforma/README.md) | *a definir* | | Microsserviços, Monitoramento, Health/Backups | ⬜ | M0 | Caminho crítico no Sprint 0 |
| [F2 Identidade & Comunidades](frentes/identidade/README.md) | *a definir* | | Ger. de usuários, Upload | ⬜ | M0 | Auth é caminho crítico |
| [F3 Social em Tempo Real](frentes/social/README.md) | *a definir* | | Tempo real, Interação, Notificações | ⬜ | M0 | |
| [F4 Trilhas & Mapas](frentes/trilhas/README.md) | *a definir* | | Busca avançada | ⬜ | M0 | Spike do OSM no Sprint 0 |
| [F5 Assistente IA](frentes/ia/README.md) | *a definir* | | LLM, RAG | ⬜ | M0 | Depende da ADR-0007 |

## Módulos

| # | Módulo | Pts | Frente | Status | Evidência (PR / demo) |
|---|---|---|---|---|---|
| 1–2 | Frameworks (Next.js) | 2 | F1 | ⬜ | |
| 3 | ORM (Prisma) | 1 | F1 | ⬜ | |
| 4 | Gerenciamento de usuários | 2 | F2 + F3 | ⬜ | |
| 5 | Interação entre usuários | 2 | F3 + F2 | ⬜ | |
| 6 | Tempo real | 2 | F3 | ⬜ | |
| 7 | Microsserviços | 2 | F1 | ⬜ | |
| 8 | Busca avançada | 1 | F4 | ⬜ | |
| 9 | Upload de arquivos | 1 | F2 | ⬜ | |
| 10 | Notificações | 1 | F3 | ⬜ | |
| 11 | Interface de LLM | 2 | F5 | ⬜ | |
| 12 | RAG | 2 | F5 | ⬜ | |
| 13 | Prometheus + Grafana | 2 | F1 | ⬜ | |
| 14 | Health, status page e backups | 1 | F1 | ⬜ | |

**Placar:** previsto 21 · 🟢 pronto para demo: 0 · ✅ validado em ensaio: 0

## Marcos

Datas propostas; confirme no kickoff. Detalhes em [ROADMAP.md](ROADMAP.md).

| Marco | Data alvo | Status | Critério de saída (resumo) |
|---|---|---|---|
| M0 Esqueleto andando | 2026-10-11 | ⬜ | `make` sobe tudo com HTTPS; login funciona; lista de trilhas vem do `trails`; socket conecta; IA faz streaming de "olá" |
| M1 Núcleo navegável | 2026-10-25 | ⬜ | Páginas principais com dados reais; perfil, amigos, chat básico, detalhe de trilha |
| M2 Funcionalidades completas | 2026-11-08 | ⬜ | Todos os 14 módulos funcionando (pelo menos 🟡 avançado); feature freeze de escopo |
| M3 Release candidate | 2026-11-22 | ⬜ | Todos os módulos 🟢; console limpo; README completo; DR testado |
| M4 Avaliação | 2026-11-29 | ⬜ | Ensaio completo feito; todos ✅ |

## Bloqueios e dependências abertas

| Data | Quem está bloqueado | Bloqueio | Depende de | Ação / responsável |
|---|---|---|---|---|
| | | | | |

## Divergências entre docs e código

Encontrou um doc que não bate com o código e não é da sua frente? Registre aqui (AGENTS.md §8).

| Data | Onde | O que o doc diz × o que o código faz | Quem resolve |
|---|---|---|---|
| | | | |

## Decisões pendentes (kickoff)

- [ ] Definir papéis (PO, PM, Tech Lead)
- [ ] Definir o dono de cada frente
- [ ] Nome do projeto
- [ ] Confirmar as datas dos marcos (início e data provável da avaliação)
- [ ] Provedor de LLM e orçamento ([ADR-0007](adr/0007-provedor-llm-embeddings.md))
- [ ] Aceitar ou ajustar as ADRs 0001–0009
- [ ] Criar o repositório no GitHub, o Project board, as labels e a proteção da `main`
- [ ] Criar o servidor no Discord com os canais de [PROCESS.md](PROCESS.md#comunicação)
- [ ] Logins da 42 de cada membro (primeira linha do README)
