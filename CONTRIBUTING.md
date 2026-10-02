# Contribuindo

> Última atualização: 2026-10-01
> Git, branches, commits, PRs e revisão. O processo do time (rituais, tarefas, uso de IA) está em [docs/PROCESS.md](docs/PROCESS.md).

## Por que isso importa para a nota

O subject exige que o repositório mostre **commits de todos os membros**, **mensagens claras** e **distribuição adequada do trabalho**. O histórico do git é avaliado.

## Configuração inicial (uma vez por pessoa)

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"   # o mesmo e-mail da sua conta do GitHub
git config --global pull.rebase true                       # git pull faz rebase em vez de merge
git config --global rebase.autoStash true
```

O setup do ambiente de desenvolvimento (Node, pnpm, Docker) vai ficar em `docs/guides/setup.md`, escrito pela F1 no Sprint 0.

## Modelo de branches: GitHub Flow

```
main ─────●─────────●──────────●──────────●───▶   (sempre funcionando e demonstrável)
           \       /  \        /
            feat/…      fix/…
```

- **`main` é protegida:** nada de push direto. Merge só por PR com 1 aprovação e CI verde.
- **Uma branch por issue**, criada a partir da `main` atualizada, e **de vida curta** (idealmente ≤ 2 dias).
- Sem branch `develop`: com 5 pessoas e entrega rápida, o git-flow é burocracia sem benefício.

> 💡 **Conceito: por que branches curtas?** Quanto mais tempo a branch vive, mais a `main` muda por baixo dela e maior o conflito no final. Integrar cedo e com frequência (CI, de *continuous integration*) troca um conflito gigante no fim por vários pequenos e fáceis.

### Nome da branch

`<tipo>/<frente>-<issue>-<descricao-curta>`

```
feat/trilhas-23-filtro-desnivel
fix/social-41-presenca-multiplas-abas
docs/plataforma-12-runbook-backup
chore/plataforma-5-ci-lint
```

### Dia a dia

```bash
git switch main && git pull                      # main atualizada
git switch -c feat/trilhas-23-filtro-desnivel    # nova branch
# ... trabalho, commits pequenos ...
git fetch origin && git rebase origin/main       # traga a main pelo menos 1x por dia
git push -u origin feat/trilhas-23-filtro-desnivel
# abra a PR no GitHub
```

Depois de um rebase numa branch **só sua** que já está no remoto: `git push --force-with-lease` (nunca `--force` puro, e nunca em branch de outra pessoa).

## Commits: Conventional Commits

Formato: `<tipo>(<escopo>): <descrição em pt-BR, no imperativo, minúscula>`

| Tipo | Quando |
|---|---|
| `feat` | Funcionalidade nova |
| `fix` | Correção de bug |
| `docs` | Só documentação |
| `refactor` | Mudança interna sem alterar comportamento |
| `test` | Testes |
| `chore` | Build, dependências, configuração |
| `ci` | Pipeline de CI |
| `perf` | Desempenho |

Escopos: `web`, `realtime`, `trails`, `ai`, `contracts`, `service-kit`, `infra`, `docs`, `e2e`.

Bons exemplos:
```
feat(trails): adiciona filtro por faixa de desnível na busca
fix(realtime): mantém usuário online enquanto houver outra aba aberta
docs(contracts): documenta evento community.activity
chore(infra): adiciona healthcheck do redis no compose
```

Ruins: `ajustes`, `wip`, `fix bug`, `update`, `coisas do chat`.

Commits em par (ou com outra pessoa revisando ao vivo): adicione no final da mensagem
```
Co-authored-by: Nome <email-do-github@exemplo.com>
```

## Pull requests

- **Pequenas:** idealmente até ~400 linhas alteradas (sem contar lockfile e migrations geradas). PR grande é revisada mal.
- **Template obrigatório** ([.github/pull_request_template.md](.github/pull_request_template.md)), incluindo o checklist de documentação e a seção "O que aprendi".
- **Título no formato Conventional Commits**: ele vira a mensagem do commit no squash.
- **Ligue a issue:** `Closes #23` na descrição.
- **Rascunho (draft) cedo:** abra como draft para receber feedback antes de terminar.
- **Merge:** **Squash and merge**. Cada PR vira um commit limpo na `main`, com o autor da PR (e os co-autores) preservados.
- **Quem faz o merge:** o autor, depois da aprovação e do CI verde.

### Quem precisa revisar

| A PR mexe em… | Revisor obrigatório |
|---|---|
| Código da própria frente | Qualquer outra pessoa (rodízio: prefira quem conhece menos a área, porque espalha conhecimento) |
| `packages/contracts`, label `contrato` | Tech Lead + dono de cada frente consumidora |
| Schema Prisma de outra frente | Dono daquela frente |
| `compose.yaml`, `infra/`, CI, `packages/service-kit` | Dono da F1 |
| `components/ui`, layout global | Tech Lead |

Isso será automatizado com um arquivo `CODEOWNERS` assim que soubermos os usuários do GitHub de cada um (tarefa do Sprint 0).

### Revisão de código

Acordo: **toda PR recebe a primeira revisão em até 24 h.** Peça no canal `#prs`.

O que olhar, em ordem:
1. **Faz o que a issue pede?** Critérios de aceite, e de MODULES quando for módulo.
2. **Está correto e seguro?** Validação no front e no back, autorização (quem pode ver ou fazer isso?), tratamento de erro, race conditions.
3. **Gera notificação** quando cria, edita ou exclui algo?
4. **Console limpo?** Rode localmente quando houver mudança de UI.
5. **Legível?** Daria para explicar ao avaliador?
6. **Docs atualizadas?**

Escreva comentários sobre o código, nunca sobre a pessoa. Use prefixos para indicar o peso: `bloqueante:`, `sugestão:`, `dúvida:`, `nit:` (detalhe opcional).

## Resolvendo conflitos

```bash
git fetch origin
git rebase origin/main
# o git para no conflito: edite os arquivos, depois
git add <arquivos>
git rebase --continue
```

Na dúvida sobre qual lado manter num arquivo de outra frente, **pergunte ao dono** antes de resolver.

### Migrations do Prisma

Duas PRs criando migrations ao mesmo tempo é o conflito mais comum. Procedimento:
1. Faça rebase na `main` atualizada.
2. **Apague a pasta da sua migration local** (a que ainda não foi mergeada).
3. Aplique as migrations da `main` no seu banco local e gere a sua de novo (`prisma migrate dev`).
4. Commit da migration nova.

Regras: **uma migration por PR**; **nunca edite uma migration já mergeada** (crie outra); `migrate reset` apaga o banco local, então só rode sabendo disso.

## Versões e entrega

- **Tags nos marcos:** `v0.1-esqueleto` (M0), `v0.2-nucleo` (M1), `v0.3-funcionalidades` (M2), `v1.0-rc` (M3), `v1.0` (entrega).
- **Entrega na 42:** só conta o que está no repositório de entrega. Faça push do **histórico completo** (todas as branches mergeadas na `main`, sem squash geral) para preservar os commits de todos:
  ```bash
  git remote add vogsphere <url-do-repo-da-42>
  git push vogsphere main --tags
  ```
- **Antes da entrega:** confira os nomes de arquivos, se o `.env` **não** está no repo e se o `.env.example` está completo.

## Segredos

- `.env` nunca vai para o git (está no `.gitignore`). Nova variável vai para o `.env.example`, com comentário e valor de exemplo falso.
- Commitou um segredo por engano? **Avise o time imediatamente** e troque a chave. Apagar o commit não basta: o segredo já vazou.
