# Documentação: mapa

> Última atualização: 2026-10-01 — estrutura inicial.

## Comece aqui (15 minutos)

1. [PRODUCT.md](PRODUCT.md): o que estamos construindo e para quem.
2. [MODULES.md](MODULES.md): o que a avaliação vai cobrar e como vamos provar cada módulo.
3. [ARCHITECTURE.md](ARCHITECTURE.md), seções 1 a 4: como as peças se encaixam.
4. [STATUS.md](STATUS.md): onde estamos agora.
5. O README da **sua** frente em [frentes/](frentes/).

Todo o resto é material de consulta: leia quando a tarefa pedir.

## Todos os documentos

| Documento | Para quê | Tipo | Quem mantém | Quando atualizar |
|---|---|---|---|---|
| [../AGENTS.md](../AGENTS.md) | Regras para agentes de IA (e humanos) | Estável | Tech Lead | Quando mudar o jeito de trabalhar |
| [../README.md](../README.md) | README exigido pelo subject (avaliado!) | Vivo | Todos | Ao entregar feature ou módulo |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Git, branches, commits, PRs, revisão | Estável | Tech Lead | Raramente |
| [PRODUCT.md](PRODUCT.md) | Visão, páginas, escopo, regras de produto | Estável | PO | Quando o escopo mudar |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Espinha dorsal técnica: serviços, comunicação, dados, convenções | Estável | Tech Lead | Junto com ADRs |
| [MODULES.md](MODULES.md) | Módulos, pontos, critérios de aceite, como demonstrar | Vivo (status) | PO + donos | Ao avançar um módulo |
| [STATUS.md](STATUS.md) | Papéis, donos, status, marcos, bloqueios, divergências | Vivo | PM + donos | A cada PR relevante e na reunião semanal |
| [ROADMAP.md](ROADMAP.md) | Fases, marcos, dependências, caminho crítico | Estável | PM | Se o cronograma mudar |
| [RISKS.md](RISKS.md) | Pontos críticos e mitigação | Vivo | PM + Tech Lead | Semanalmente |
| [PROCESS.md](PROCESS.md) | Rituais, tarefas, uso de IA, docs, prompts prontos | Estável | PM | Nas retros |
| [LEARNING.md](LEARNING.md) | Conceitos explicados e trilhas de estudo | Vivo | Todos | Quando aprender algo que vale registrar |
| [EVALUATION.md](EVALUATION.md) | Checklist da parte obrigatória e roteiro da avaliação | Vivo | PO | Nas semanas finais |
| [contracts/README.md](contracts/README.md) | Endpoints internos, eventos, sockets | Estável | Tech Lead + donos | A cada mudança de contrato |
| [adr/](adr/) | Decisões de arquitetura (ADRs) | Estável | Quem decide | A cada decisão relevante |
| [frentes/](frentes/) | Um README por frente de trabalho + planos | Vivo | Dono da frente | A cada entrega |
| [research/](research/) | Pesquisas (ex.: dados do OSM) | Estável | Autor | Se a pesquisa for refeita |
| [templates/](templates/) | Modelos (plano de implementação) | Estável | Tech Lead | Raramente |
| [subject.md](subject.md) | Enunciado oficial do projeto | Fixo | — | Nunca |

**Tipos de documento:**
- **Estável:** muda pouco. Mudanças passam por PR revisada pelo Tech Lead.
- **Vivo:** muda a cada entrega. Cada dono atualiza a própria parte.
- **Efêmero:** planos de implementação. Valem durante a tarefa; depois de concluídos, viram histórico (úteis para explicar o trabalho na avaliação).

## Por que esta estrutura?

A pergunta era: um documento de arquitetura geral e um por módulo? A resposta foi um meio-termo, em três níveis:

1. **Um documento de arquitetura geral** ([ARCHITECTURE.md](ARCHITECTURE.md)), que encadeia tudo: serviços, contratos, dados, convenções. É o que impede cada frente de inventar um padrão diferente.
2. **Um documento por frente de trabalho**, não por módulo. Vários módulos compartilham código e dono: "Gerenciamento de usuários" e "Interação entre usuários" têm perfil e amigos em comum; "Tempo real", "Chat" e "Notificações" usam o mesmo serviço; "RAG" e "LLM" usam o mesmo serviço de IA. Um documento por módulo duplicaria conteúdo e dobraria o trabalho de manutenção. Cada frente tem um dono e o seu README diz **o quê e por quê**: escopo, critérios de aceite, dependências, conceitos.
3. **Um plano de implementação por tarefa não trivial**, criado na hora de implementar a partir de [templates/plano-implementacao.md](templates/plano-implementacao.md). Só nesse momento dá para saber o que já existe no código e o que outras frentes já decidiram. O plano começa obrigatoriamente com "Estado atual verificado".

O mapeamento de módulos para frentes está em [MODULES.md](MODULES.md).

## Hierarquia da verdade

1. [subject.md](subject.md): requisitos oficiais.
2. **Código e `git log`:** o que existe de fato.
3. **Contratos e ADRs aceitas:** o que foi combinado entre frentes.
4. **READMEs das frentes e planos:** como pretendemos fazer.

Se 2 e 3 divergem, ou é bug ou é decisão não registrada. Avise o dono e registre em [STATUS.md](STATUS.md), seção "Divergências".

## Caminhos de leitura

- **Vou implementar uma tarefa:** issue → [STATUS.md](STATUS.md) → README da frente → [contracts/README.md](contracts/README.md) (se tocar outro serviço) → código atual → plano (se não for trivial).
- **Vou revisar uma PR:** critérios de aceite da issue → [MODULES.md](MODULES.md) (se for módulo) → checklist do template de PR → [../CONTRIBUTING.md](../CONTRIBUTING.md#revisão-de-código).
- **Sou um agente de IA:** o `AGENTS.md` já foi carregado; siga a §3 dele.
- **Preparação para a avaliação:** [EVALUATION.md](EVALUATION.md) e "Como demonstrar" em [MODULES.md](MODULES.md).

## Como evitar documentação defasada

Nem todo mundo vai usar agente o tempo todo, e documentação atrasada é pior que documentação nenhuma, porque engana (inclusive os agentes). Por isso:

- **Docs pequenos e focados no "porquê".** O "como" detalhado vive no código e nos planos. Menos texto, menos coisa para ficar velha.
- **Linha `Última atualização` no topo** de todo doc vivo. Doc antigo com código novo é sinal de alerta.
- **Checklist de documentação no template de PR**, para quem trabalha sem agente.
- **Auditoria semanal de 10 minutos** feita pelo PM com um agente, usando o prompt pronto em [PROCESS.md](PROCESS.md#prompts-prontos). As divergências entram em [STATUS.md](STATUS.md).
- **"Se não está no repo, não foi decidido."** Decisão tomada no Discord precisa virar ADR ou entrar na seção "Decisões" da frente.

## Estrutura de pastas

```
docs/
├── README.md              ← você está aqui
├── PRODUCT.md  ARCHITECTURE.md  MODULES.md  STATUS.md  ROADMAP.md
├── RISKS.md  PROCESS.md  LEARNING.md  EVALUATION.md
├── subject.md             ← enunciado oficial
├── adr/                   ← 0000-template.md + uma ADR por decisão
├── contracts/README.md    ← endpoints internos, eventos e sockets
├── frentes/
│   ├── plataforma/        ← F1: README.md + planos/
│   ├── identidade/        ← F2
│   ├── social/            ← F3
│   ├── trilhas/           ← F4
│   └── ia/                ← F5
├── research/osm-trilhas.md
└── templates/plano-implementacao.md
```

Documentos que serão criados durante o projeto (pelas frentes indicadas): `docs/runbooks/disaster-recovery.md` (F1), `docs/guides/setup.md` (F1, Sprint 0).
