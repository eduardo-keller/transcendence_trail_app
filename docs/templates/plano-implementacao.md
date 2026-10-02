# Plano: <título curto>

<!--
COMO USAR ESTE TEMPLATE
- Copie para docs/frentes/<frente>/planos/<issue>-<slug>.md (ex.: planos/23-filtro-desnivel.md).
- Preencha ANTES de escrever código e peça revisão (Tech Lead se tocar contrato, schema ou infra; senão, um colega).
- Seja breve: um plano bom cabe em 1–2 telas. Apague as seções que não se aplicam.
- Durante a implementação, atualize "Registro de execução". Ao terminar, mude o status para Concluído.
-->

- **Issue:** #
- **Frente:** <!-- plataforma | identidade | social | trilhas | ia -->
- **Módulo(s):** <!-- da docs/MODULES.md -->
- **Autor(es):**
- **Status:** Rascunho | Em revisão | Aprovado | Em execução | Concluído | Abandonado
- **Última atualização:** AAAA-MM-DD

## 1. Objetivo

<!-- 2–3 linhas: o que estará funcionando ao final e por que importa. -->

## 2. Estado atual verificado

<!-- OBRIGATÓRIO. O que existe HOJE no código (não nos docs) que esta tarefa usa ou altera.
     Cite arquivos. Aponte divergências entre docs e código, se houver (e registre em STATUS.md). -->

- 

## 3. Escopo

**Dentro:**
- 

**Fora (fica para outra tarefa):**
- 

## 4. Critérios de aceite

<!-- Copie da issue ou de MODULES.md e complete. Devem ser verificáveis. -->

- [ ] 
- [ ] Sem erros ou warnings no console
- [ ] Notificações conforme a matriz (se houver criar, editar ou excluir)

## 5. Desenho

<!-- Só o que for relevante. Prefira listas e tabelas curtas a prosa. -->

**Dados** (modelos e campos novos ou alterados, constraints, índices):

**API / Server Actions** (rota, entrada, saída, erros, quem pode chamar):

**Eventos e sockets** (nome, produtor, consumidores, payload):

**UI** (páginas, componentes, estados: carregando, vazio, erro):

**Fluxo** (opcional: diagrama de sequência em mermaid):

## 6. Impacto em outras frentes e contratos

<!-- Quem precisa saber ou aprovar? Mudou algo em packages/contracts? -->

| Frente / dono | Impacto | Aprovado? |
|---|---|---|
| | | |

## 7. Passos

<!-- Pequenos e ordenados. Cada passo deixa a main funcionando (pode virar um commit ou uma PR). -->

- [ ] 1.
- [ ] 2.
- [ ] 3. Testes
- [ ] 4. Documentação (AGENTS.md §7)

## 8. Como verificar

<!-- Testes automatizados + roteiro manual (usuários do seed, páginas, o que observar). -->

## 9. Riscos e dúvidas em aberto

- 

## 10. Para aprender

<!-- Conceitos que esta tarefa exercita, com links (docs/LEARNING.md ou docs oficiais).
     Se o autor quiser escrever parte do código sem IA para aprender, marque aqui qual. -->

- 

## 11. Registro de execução

<!-- Preencha durante a implementação: decisões tomadas no caminho, desvios do plano e o porquê, problemas encontrados.
     Isso vira material para "challenges faced" no README. -->

| Data | O que aconteceu / decidimos |
|---|---|
| | |
