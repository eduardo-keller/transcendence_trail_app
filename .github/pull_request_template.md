## O que muda

<!-- 2–4 linhas: o que esta PR faz e por quê. -->

Closes #

**Frente:** <!-- plataforma | identidade | social | trilhas | ia -->
**Módulo(s) da avaliação:** <!-- ex.: Busca avançada -->
**Plano:** <!-- link para docs/frentes/<frente>/planos/... ou "não se aplica (tarefa pequena)" -->

## Como testar

<!-- Passos para o revisor reproduzir. Inclua usuários do seed, URLs, comandos. -->
1.

## Checklist (Definition of Done)

- [ ] Critérios de aceite da issue atendidos
- [ ] Entradas novas validadas no front **e** no back (zod)
- [ ] Lint, typecheck e testes passando
- [ ] Testei no Chrome com o DevTools aberto: **nenhum erro ou warning no console**
- [ ] Ações de criar, editar ou excluir geram notificação ([matriz](../docs/frentes/social/README.md#matriz-de-notificações)), ou não se aplica
- [ ] Autorização conferida no servidor (quem pode ver ou fazer isso?), ou não se aplica
- [ ] Nenhum segredo no diff; `.env.example` atualizado se criei uma variável
- [ ] Mudou contrato? Label `contrato` + revisão dos donos afetados

### Documentação ([AGENTS.md §7](../AGENTS.md#7-como-atualizar-a-documentação-parte-da-definition-of-done))
- [ ] `docs/STATUS.md` (se mudou o status de frente ou módulo)
- [ ] `docs/contracts/README.md` + `packages/contracts` (se mudou endpoint ou evento)
- [ ] README da frente (Estado atual / Decisões)
- [ ] `README.md` raiz (Features), se é visível ao usuário
- [ ] ADR (se é decisão que afeta mais de uma frente)
- [ ] Nada a atualizar (justifique):

## Uso de IA nesta PR

<!-- Ferramenta(s), para quê, e o que você revisou ou reescreveu. Alimenta a seção "AI usage" do README. -->

## O que aprendi / como eu explicaria isso na avaliação

<!-- Escrito POR VOCÊ, não pela IA. 2–5 linhas. Também serve de base para "Individual Contributions" no README. -->
