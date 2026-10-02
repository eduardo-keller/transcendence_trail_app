# Como trabalhamos

> Última atualização: 2026-10-01 — processo inicial (ajustar nas retros).
> Dono: PM. Git e PRs ficam em [CONTRIBUTING.md](../CONTRIBUTING.md).

Princípio geral: **o mínimo de processo que mantém 5 pessoas sincronizadas e aprendendo.** Se um ritual não está ajudando, a retro decide mudar.

## Papéis

O subject exige PO, PM e Tech Lead, todos documentados no README. Com 5 pessoas, cada uma é **dona de uma frente** e duas também acumulam um papel. Todos programam.

| Papel | O que faz no dia a dia | Sugestão |
|---|---|---|
| **Product Owner** | Mantém backlog e prioridades; aceita ou recusa entregas segundo os critérios de aceite; escreve Privacidade e Termos; monta o roteiro da avaliação | Combina com a F4 (Trilhas), que é o coração do produto |
| **Project Manager** | Facilita os rituais; mantém [STATUS.md](STATUS.md) e [RISKS.md](RISKS.md); persegue bloqueios; faz a auditoria semanal de docs | Combina com uma frente menos crítica no Sprint 0 (F3 ou F5) |
| **Tech Lead** | Dono de ARCHITECTURE, ADRs e contratos; revisa PRs de contrato, schema e infra; cuida de `components/ui` e do layout | Combina com a F1 (Plataforma), que define a arquitetura no Sprint 0 |
| **Dev (todos)** | Implementa, revisa PRs de outras frentes, documenta, demonstra | — |

A decisão de quem faz o quê fica em [STATUS.md](STATUS.md#papéis).

## Rituais

| Ritual | Quando | Duração | Formato |
|---|---|---|---|
| **Kickoff** | Semana 1, dia 1 | 2 h | Ler juntos PRODUCT, MODULES e ARCHITECTURE; fechar as decisões pendentes; distribuir frentes; criar o board |
| **Planejamento** | Segunda | 45 min | Revisar STATUS e o board; cada dono escolhe as issues da semana; mapear dependências entre frentes |
| **Daily assíncrona** | Todo dia até 11h, no Discord `#daily` | 2 min | Modelo abaixo |
| **Demo + aula relâmpago** | Sexta | 60 min | Cada frente mostra algo **rodando** (≤ 5 min cada) + uma pessoa explica um conceito para o time (15 min) |
| **Retro** | A cada 2 semanas, após a demo | 15 min | Manter / parar / começar |
| **Ensaio de avaliação** | Semanas 7 e 8 | 1–2 h | Roteiro de [EVALUATION.md](EVALUATION.md) com rodízio de quem apresenta |

Modelo da daily:
```
Ontem: <o que fiz, link da PR/issue>
Hoje: <o que vou fazer>
Bloqueio: <nada | o quê, e de quem dependo>
```

A demo de sexta é o ritual mais importante: **força a integração** (se não roda, não dá para mostrar), **espalha o conhecimento** (todos precisam saber explicar tudo na avaliação) e **treina para a avaliação**.

## Comunicação

Discord com os canais:
- `#avisos`: decisões e combinados (só leitura, exceto PM e PO)
- `#daily`: check-in assíncrono
- `#dev`: dúvidas técnicas
- `#prs`: pedido de revisão (link + uma frase)
- `#bloqueios`: "estou parado por causa de X"; o PM responde em até meio dia
- `#decisoes`: discussões que podem virar ADR
- `#alertas`: Alertmanager envia os alertas aqui (módulo de monitoramento)

Regra: **se não está no repo, não foi decidido.** Uma decisão tomada no Discord precisa virar ADR, entrar em "Decisões" da frente ou atualizar um doc, e quem decidiu faz isso.

## Onde fica cada informação

| Informação | Onde | Por quê |
|---|---|---|
| Tarefa individual: quem faz, status, discussão | **GitHub Issues + Projects** | O status muda várias vezes por dia. Um markdown só chega na `main` quando o PR é mergeado, ou seja, quando a tarefa já acabou. O board é ao vivo. |
| Status de frentes, módulos, marcos, bloqueios | `docs/STATUS.md` | Visão macro que muda pouco e precisa estar no repo para os agentes lerem |
| Escopo e critérios de cada frente | `docs/frentes/<frente>/README.md` | Estável, versionado junto com o código |
| Como implementar uma tarefa | `docs/frentes/<frente>/planos/` | Nasce e é revisado junto com o PR |
| Decisões | ADRs ou "Decisões" da frente | Rastreáveis e úteis para o README |

### GitHub Projects
- Colunas: **Backlog → Pronto → Em andamento → Em revisão → Concluído**.
- Campos: Frente, Marco (M0–M4), Tamanho (**P** ≤ meio dia, **M** ≤ 2 dias, **G** > 2 dias: quebre em tarefas menores), Prioridade (P0, P1, P2).
- Labels: `frente:plataforma|identidade|social|trilhas|ia`, `tipo:feature|bug|docs|chore|spike`, `contrato` (exige revisão cruzada), `bloqueado`.
- **Toda issue em andamento tem um responsável** (assignee). Isso responde "quem está fazendo o quê".
- Agentes podem ler issues com `gh issue view <n>`; mover cards é responsabilidade do humano.

### Definition of Ready (antes de puxar uma tarefa)
- [ ] Contexto e critérios de aceite escritos na issue
- [ ] Frente, marco e tamanho preenchidos (tamanho G não pode: quebre)
- [ ] Dependências conhecidas e prontas, ou com substituto temporário ([ROADMAP.md §5](ROADMAP.md#5-como-trabalhar-em-paralelo-sem-bloquear))

### Definition of Done (antes de fechar)
- [ ] PR mergeado com o checklist do template completo (inclui docs, console limpo, notificações e validação)
- [ ] Critérios de aceite verificados por outra pessoa (revisor ou PO)
- [ ] Demonstrável na `main`

## Fluxo para implementar um módulo ou funcionalidade

1. **Entender:** o dono lê o README da frente, os critérios em MODULES, o STATUS e **o código atual**.
2. **Quebrar:** cria issues de tamanho P ou M no board.
3. **Planejar (tarefas não triviais):** cria `docs/frentes/<frente>/planos/<issue>-<slug>.md` a partir do [template](templates/plano-implementacao.md). Tarefa não trivial é a que leva mais de meio dia, mexe em contrato ou schema, ou afeta outra frente.
4. **Revisar o plano:** o Tech Lead revisa se toca contrato, schema ou infra; nos outros casos, um colega. Revisar o plano é barato e evita retrabalho.
5. **Implementar** em PRs pequenos, cada um deixando a `main` funcionando.
6. **Mostrar** na demo de sexta.

O plano existe porque **os documentos de arquitetura nunca cobrem tudo**. Na hora de implementar aparecem perguntas que ninguém previu, e o plano é o lugar de respondê-las levando em conta o que já foi feito.

## Uso de IA pelos humanos

Vamos usar bastante IA, e isso é bom. As regras abaixo existem para que a IA acelere **sem** tirar o aprendizado e sem criar risco na avaliação.

1. **Você é o autor.** Todo código que entra com o seu nome foi lido e entendido por você. Se não consegue explicar uma linha, não faça o merge.
2. **Use IA à vontade para:** boilerplate, configuração (Docker, nginx, CI), testes, pesquisa, entender mensagens de erro, revisar PRs, escrever docs.
3. **Escreva você mesmo, ou em par com a IA como tutora,** a lógica central do seu módulo. Exemplos: a query de busca geoespacial, o handler de chat, o cálculo de desnível, o pipeline de RAG, a checagem de permissão em comunidades. É isso que o avaliador vai pedir para explicar e modificar.
4. **Registre o uso de IA na PR** (campo do template). O README exige uma seção sobre como a IA foi usada, e ela vai ser montada a partir desses registros.
5. **Não cole segredos** (`.env`, chaves) nem dados pessoais de usuários em prompts.
6. **Agentes seguem o [AGENTS.md](../AGENTS.md).** Se você programar sem agente, o checklist do template de PR cobre o mesmo que o agente faria.

### Trabalhando sem agente
O mínimo para não deixar a documentação para trás:
1. Preencha o checklist do template de PR, incluindo a parte de docs.
2. Atualize a linha da sua frente ou módulo em `docs/STATUS.md` quando algo mudar de estado.
3. Mudou um contrato? Atualize `packages/contracts` e a tabela em `docs/contracts/README.md` e marque a label `contrato`.
4. Atalho: antes de abrir a PR, peça a um agente "atualize a documentação conforme a tabela do AGENTS.md §7 para o diff desta branch" e revise o resultado.

## Manutenção da documentação

- **Dono por documento:** veja o mapa em [docs/README.md](README.md).
- **Auditoria semanal (10 min, PM):** antes do planejamento de segunda, rode o prompt de auditoria (abaixo) com um agente. As divergências vão para [STATUS.md](STATUS.md#divergências-entre-docs-e-código) e viram issues para os donos.
- **Retro:** algum doc ninguém lê? Simplifique ou apague. Documento morto engana.

## Prompts prontos

Copie, cole e ajuste. Funcionam em qualquer agente que leia o `AGENTS.md`.

**Começar uma tarefa**
```
Leia o AGENTS.md e a issue #<N>. Verifique o estado atual do código da frente <frente>
(arquivos relevantes e git log recente). Se a tarefa não for trivial, proponha um plano
usando docs/templates/plano-implementacao.md e salve em docs/frentes/<frente>/planos/.
Não escreva código antes da minha aprovação. Liste dúvidas que afetem contratos ou outras frentes.
```

**Atualizar a documentação da branch**
```
Compare esta branch com a main. Seguindo a tabela do AGENTS.md §7, atualize a documentação
necessária (STATUS, contratos, README da frente, README.md, .env.example). Não invente
conteúdo de "Contribuições individuais". Liste o que mudou em cada arquivo.
```

**Auditoria semanal de documentação**
```
Audite docs/ARCHITECTURE.md, docs/contracts/README.md, docs/STATUS.md e os READMEs em
docs/frentes/ contra o código atual da main. Liste divergências em uma tabela
(arquivo do doc, o que o doc diz, o que o código faz, arquivo de código, sugestão).
Não corrija nada: apenas reporte.
```

**Revisar uma PR**
```
Revise a PR #<N> considerando: critérios de aceite da issue; requisitos do módulo em
docs/MODULES.md; validação no front e no back; notificações conforme a matriz em
docs/frentes/social/README.md; possíveis erros de console; segurança e autorização;
documentação atualizada. Aponte problemas por ordem de gravidade.
```

**Estudar um trecho do código**
```
Explique como funciona <arquivo ou fluxo> como se eu fosse apresentar ao avaliador da 42:
o que faz, por que foi feito assim, que alternativas existiam. Depois me faça 3 perguntas
para checar se entendi, e não dê as respostas até eu tentar.
```

**Simular a modificação ao vivo da avaliação**
```
Aja como avaliador da 42. Peça uma modificação pequena (5–10 min) no módulo <módulo>,
como as do subject (mudar um comportamento, adicionar um campo, ajustar uma tela).
Não me ajude a implementar. Quando eu terminar, avalie o que fiz.
```
