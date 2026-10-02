@AGENTS.md

<!--
O Claude Code lê CLAUDE.md. A linha acima importa o AGENTS.md, que é a fonte única
de instruções para todos os agentes. Não duplique instruções aqui: edite o AGENTS.md.
Adicione abaixo apenas o que for específico do Claude Code.
-->

## Específico do Claude Code

- Para tarefas não triviais, use o modo de plano e salve o plano aprovado em `docs/frentes/<frente>/planos/` (AGENTS.md §4).
- Use o subagente `Explore` para buscas amplas no código. Não delegue tarefas pequenas.
- Skills do projeto ficam em `.claude/skills/`, versionadas e revisadas pelo Tech Lead.
