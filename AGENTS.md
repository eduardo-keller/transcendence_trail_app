# AGENTS.md

> Instruções para **agentes de IA** (Claude Code, Codex, Cursor, Copilot, Gemini CLI…) e para **humanos** que querem saber como as coisas funcionam aqui.
> Este arquivo é um **mapa curto**: aponta para a documentação, não a substitui. Se passar de ~200 linhas, mova detalhes para `docs/`.
> Última atualização: 2026-10-01 — versão inicial do plano.

## 1. O projeto em 30 segundos

- **ft_transcendence** (42 São Paulo). Time de 5: Eduardo, Ju, Gabriel, Diego e Rafael.
- **Produto:** app de trilhas no estilo Wikiloc para São Paulo e entorno, com dados do OpenStreetMap, perfis, amigos, chat, comunidades e um assistente de IA. Ver [docs/PRODUCT.md](docs/PRODUCT.md).
- **Objetivo duplo:** (1) passar na avaliação: mínimo de 14 pontos, meta de 21 ([docs/MODULES.md](docs/MODULES.md)); (2) **aprender**: todo membro precisa conseguir explicar qualquer parte do projeto.
- **Stack:** Next.js (`apps/web`) + serviços Fastify (`services/realtime`, `services/trails`, `services/ai`) + PostgreSQL (PostGIS, pgvector) + Redis + Socket.IO + Docker/nginx + Prometheus/Grafana. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Especificação oficial:** [docs/subject.md](docs/subject.md). Se houver conflito com qualquer outro documento, o subject prevalece.

## 2. Idioma

- **pt-BR:** documentação, comentários, descrições de commits e PRs, textos de interface, conversa com o usuário.
- **Inglês:** identificadores de código, tabelas e colunas, rotas, nomes de eventos, nomes de arquivos de código.
- Commits seguem Conventional Commits com tipo e escopo em inglês e descrição em pt-BR: `feat(trails): adiciona filtro por desnível`.

## 3. O que ler antes de agir

| Se a tarefa envolve… | Leia |
|---|---|
| Qualquer coisa | `docs/STATUS.md` (onde estamos) e o README da frente em `docs/frentes/<frente>/` |
| Comunicação entre serviços, eventos, sockets | `docs/contracts/README.md` + `packages/contracts/` |
| Arquitetura ou escolha de tecnologia | `docs/ARCHITECTURE.md` + `docs/adr/` |
| Requisito de um módulo da avaliação | `docs/MODULES.md` (critérios de aceite) |
| Git, branches, commits, PRs | `CONTRIBUTING.md` |
| Processo do time, uso de IA, aprendizado | `docs/PROCESS.md`, `docs/LEARNING.md` |
| Dados do OpenStreetMap | `docs/research/osm-trilhas.md` |

Não leia tudo: leia o que a tarefa exige. O índice completo está em `docs/README.md`.

## 4. Fluxo de trabalho do agente

1. **Identifique a tarefa:** a issue do GitHub (`gh issue view <n>`, se disponível) e a frente. Sem issue, peça ao humano ou proponha o texto de uma.
2. **Verifique o estado real:** leia o código e o `git log` da área antes de confiar nos docs (ver §8).
3. **Planeje se não for trivial.** Plano é obrigatório quando a tarefa leva mais de ~meio dia, cria ou altera contrato ou schema, ou toca outra frente. Crie `docs/frentes/<frente>/planos/<issue>-<slug>.md` a partir de `docs/templates/plano-implementacao.md` e **peça aprovação do humano antes de escrever código**.
4. **Implemente em passos pequenos.** Cada passo compila e roda. Commits conforme `CONTRIBUTING.md`.
5. **Verifique:** lint, typecheck, testes, rode a funcionalidade, abra o Chrome e confira o console limpo.
6. **Atualize a documentação** no mesmo PR (§7).
7. **Feche com um resumo:** o que mudou, como testar, quais docs foram atualizados, pendências e uma seção **"Para aprender"** com 3 a 5 conceitos usados (com link para `docs/LEARNING.md` ou para a documentação oficial).

## 5. Perguntar ou decidir?

**Pergunte e espere** quando a dúvida afeta contratos entre serviços, schema de banco, outra frente, o escopo de um módulo avaliado, segurança, custos (API de LLM) ou a interpretação do subject. Junte as perguntas numa única mensagem e traga sua recomendação para cada uma.

**Decida, siga e registre** quando a escolha é local, reversível e está dentro da frente (estrutura de componente, nome interno, função auxiliar). Registre na seção "Decisões" do README da frente ou no plano.

## 6. Princípios de código

- **Simples primeiro.** O objetivo é cumprir os critérios de aceite com código legível que o time saiba explicar na avaliação. Nada de abstração "para o futuro".
- **Siga o padrão existente.** Antes de criar algo, procure algo parecido no repo. Nova dependência ou novo padrão: justifique na PR; se afetar mais de uma frente, escreva uma ADR.
- **Refatoração só no escopo da tarefa.** Para refatorar código de outra frente, abra uma issue e combine com o dono.
- **Cada serviço acessa apenas o próprio banco.** Dados de outro serviço chegam por REST interno ou por evento (ver `docs/contracts/`).
- **Contratos vivem em `packages/contracts`** (schemas zod). Mudou um contrato: label `contrato` na PR e revisão dos donos afetados.
- **Validação nos dois lados:** zod no formulário e no backend (exigência do subject).
- **Ações de criar, editar e excluir geram notificação** (módulo de notificações). Consulte a matriz em `docs/frentes/social/README.md`.
- **Console do Chrome sem erros nem warnings** (isso reprova o projeto). Fique atento a erros de hydration, `key` faltando no React, fetch com 401/404, tiles do mapa falhando e socket tentando conectar sem login.
- **Segredos só no `.env`** (ignorado pelo git). Nova variável vai para o `.env.example` com comentário.
- **Testes enxutos e úteis:** lógica pura (cálculos, permissões, validações) com Vitest; fluxos críticos com Playwright. Não escreva teste trivial só para aumentar a contagem.

## 7. Como atualizar a documentação (parte da Definition of Done)

Atualize **no mesmo PR** do código:

| Se você… | Atualize |
|---|---|
| Avançou ou concluiu algo de um módulo ou frente | a linha correspondente em `docs/STATUS.md` |
| Criou ou alterou endpoint interno, evento ou evento de socket | `packages/contracts` + tabela em `docs/contracts/README.md` |
| Tomou decisão que afeta mais de uma frente, adiciona tecnologia ou é difícil de reverter | nova ADR em `docs/adr/` com status **Proposta**, e avise o humano |
| Tomou decisão local | seção "Decisões" do README da frente |
| Entregou funcionalidade visível ao usuário | "Features" no `README.md` (com responsável) e "Estado atual" no README da frente |
| Criou variável de ambiente | `.env.example` |
| Mudou o modelo de dados | schema Prisma (fonte da verdade) + diagrama em `docs/ARCHITECTURE.md` se mudou alguma relação |
| Executou um plano | marque os passos, preencha o "Registro de execução" e mude o status do plano |

Regras:
- Edite só o necessário e mantenha o estilo do documento. Atualize a linha `Última atualização` no topo do doc alterado.
- Não reescreva docs de outra frente: sugira a mudança na PR ou abra uma issue.
- **Nunca invente** o conteúdo de "Contribuições individuais" ou de "O que aprendi". Isso é escrito pela própria pessoa.
- Planos com status **Concluído** são histórico, não especificação atual.

## 8. A documentação pode estar defasada

Nem todos usam agentes o tempo todo, então os docs podem atrasar em relação ao código.
1. **Código e `git log` dizem o que existe.** Os docs dizem **o que foi combinado** (contratos, decisões, critérios de aceite).
2. Encontrou divergência? Se for na sua frente e a correção for óbvia, corrija o doc no seu PR. Se for contrato, decisão ou outra frente, **não "conserte" sozinho**: avise o humano e registre em `docs/STATUS.md`, seção "Divergências".
3. Desconfie de docs cuja `Última atualização` é bem mais antiga que os commits recentes da área.

## 9. Limites

**Nunca:** commitar `.env` ou segredos; fazer push direto na `main`; usar `push --force` em branch compartilhada; editar migration já mergeada; desabilitar lint, teste ou typecheck para "passar"; usar dados do Wikiloc, AllTrails ou de qualquer fonte sem licença compatível; enviar dados pessoais de usuários a serviços externos fora do fluxo previsto.

**Pergunte antes de:** rodar comandos destrutivos (`docker volume rm`, `prisma migrate reset`, `DROP`, apagar backups); adicionar dependência; mudar `compose.yaml`, nginx, CI ou o schema de outra frente; instalar skills, MCPs ou plugins de agente; fazer chamadas pagas à API de LLM em loop ou em lote.

## 10. Comandos

> A frente Plataforma preenche esta seção no Sprint 0. Até lá, não invente comandos.

| Objetivo | Comando |
|---|---|
| Subir tudo (modo avaliação) | `make` *(a definir)* |
| Desenvolvimento com hot reload | *(a definir)* |
| Lint, typecheck e testes | *(a definir)* |
| Migrations e seed | *(a definir)* |

Cada serviço pode ter um `AGENTS.md` próprio com comandos e convenções locais. O arquivo mais próximo do código editado prevalece.

## 11. Ferramentas e contexto

- **Versões mudam rápido.** Confira a versão no `package.json` e consulte a documentação oficial **daquela versão** antes de usar APIs de Next.js, Prisma, Better Auth, Socket.IO etc. que você "lembra".
- **Subagentes e execução paralela** (se a ferramenta suportar): use para explorar muito código, pesquisar ou fazer tarefas realmente independentes. Não delegue tarefas pequenas: perde contexto e custa mais.
- **Skills e regras de ferramenta** ficam versionadas no repo (ex.: `.claude/skills/`) e são revisadas como código. O agente não instala skills de terceiros por conta própria.
- O `CLAUDE.md` só importa este arquivo. Não duplique instruções lá.

## 12. Aprendizado sem travar a entrega

- Explique em 1 ou 2 frases o porquê de escolhas não óbvias **enquanto** implementa. Sem aulas longas que ninguém pediu.
- Quando o humano pedir para entender algo, explique com profundidade, usando exemplos do próprio código.
- Sugira que o humano escreva as partes centrais (query PostGIS, handler de socket, pipeline de RAG…) quando isso for didático e não bloquear a entrega.
- Lembre que, na avaliação, cada membro precisa explicar o código e pode ter que modificá-lo ao vivo.
