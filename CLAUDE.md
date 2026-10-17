# CLAUDE.md

Instruções para agentes de IA neste repositório. Quem usa agente no time é só o Edu (IA, gamificação e coordenação). As outras quatro pessoas leem `docs/` **sem** agente: por isso os docs do time precisam continuar curtos.

## Projeto

ft_transcendence (42 São Paulo), time de 5. App de trilhas estilo Wikiloc para São Paulo: Next.js 16 (front + back) + Prisma 7 + PostgreSQL 18 (PostGIS, pgvector) + Better Auth, em Docker. Produto, pessoas e módulos: [docs/PLANO.md](docs/PLANO.md).

## Hierarquia da verdade

1. [docs/subject.md](docs/subject.md): requisitos oficiais.
2. O código e o `git log`: o que existe de fato. Verifique antes de confiar num doc.
3. `docs/`: o que o time combinou.

Doc divergente do código: se a correção é óbvia, corrija o doc na mesma mudança; se envolve a área de outra pessoa ou uma decisão, avise o Edu em vez de "consertar".

## Onde está cada coisa

| Preciso de… | Leia |
|---|---|
| O que um módulo exige e quem é o dono | [docs/MODULOS.md](docs/MODULOS.md) |
| Convenções, pastas, interfaces entre pessoas, git | [docs/TECNICO.md](docs/TECNICO.md) |
| Decisões técnicas (tomadas e pendentes) | [docs/decisoes/README.md](docs/decisoes/README.md) |
| Dados de trilhas (origem, importação, pendências, licenças) | [docs/dados-trilhas.md](docs/dados-trilhas.md) |
| Consultas ao OpenStreetMap (POIs e parques para o RAG) | [docs/agente/consultas-osm.md](docs/agente/consultas-osm.md) |
| Comandos e setup | [README.md](README.md#instructions) e [Makefile](Makefile) |
| Requisitos eliminatórios e roteiro da avaliação | [docs/AVALIACAO.md](docs/AVALIACAO.md) |
| Estado da coordenação, dependências, pendências | [docs/agente/README.md](docs/agente/README.md) |
| Planos de implementação | [docs/agente/planos/](docs/agente/planos/) |

## Como trabalhar

- **Tarefa não trivial** (mais de meio dia, mexe no schema ou numa interface compartilhada, ou toca a área de outra pessoa): proponha um plano a partir de [docs/agente/planos/TEMPLATE.md](docs/agente/planos/TEMPLATE.md) e espere a aprovação antes de escrever código.
- **Versões mudam rápido:** confira a versão em `apps/web/package.json` e a documentação **daquela versão** antes de usar a API do Next.js, Prisma ou Better Auth "de memória".
- **Siga o padrão existente:** helpers de API em `apps/web/src/server/api/`, cliente do banco em `src/lib/db.ts`, convenções em [TECNICO.md](docs/TECNICO.md#convenções).
- **Verifique:** `make npm args="run lint"`; rode a funcionalidade; confira o console do Chrome (erro ou warning reprova o projeto).
- **Explique o porquê** de escolhas não óbvias em uma ou duas frases. O Edu precisa explicar e modificar o código ao vivo na avaliação: sugira que ele escreva as partes centrais dos módulos dele (pipeline de RAG, streaming, regras de XP).

## Documentação

Atualize na mesma mudança, **sem inflar**:
- caixas da área em `docs/MODULOS.md` quando um item fica pronto;
- [lista de notificações](docs/MODULOS.md#ações-que-geram-notificação) quando surge uma ação de criar, editar ou excluir;
- [interfaces entre pessoas](docs/TECNICO.md#interfaces-entre-pessoas) quando algo compartilhado é criado ou muda;
- `README.md` (Features, Modules, Instructions, Database Schema) quando for o caso;
- `docker/.env.example` quando criar variável;
- os diagramas em `docs/diagramas/` quando mudar a arquitetura (`arquitetura`) ou a divisão de módulos e o que está em aberto (`divisao`). Edite o `.excalidraw` e gere o PNG com a skill `excalidraw-diagram` (instalada em `~/.claude/skills/`, só na máquina do Edu): `cd ~/.claude/skills/excalidraw-diagram/references && uv run python render_excalidraw.py <arquivo> --width 2400 --scale 1`.

Regras:
- Docs do time são para humanos sem agente: frases curtas, tabelas, sem "aulas". Detalhe de implementação vai para o código ou para `docs/agente/`.
- `docs/agente/` **nunca repete** o que está nos docs do time; só aponta para eles e acrescenta o que serve à coordenação.
- **Nunca escreva** "Individual Contributions" do README nem o "O que aprendi" das PRs por ninguém.

## Limites

**Pergunte antes de:** comandos destrutivos (`make fclean`, `make re`, `prisma migrate reset`, `docker volume rm`, apagar dados); adicionar dependência; mudar o schema, o Docker ou o nginx (área do Gabs) ou o código de outra pessoa; chamadas pagas ao LLM em loop.

**Nunca:** commitar segredos (`docker/secrets/`, `docker/.env`); editar migration já mergeada; usar dados do Wikiloc, AllTrails ou similares; desligar lint ou validação para "passar".
