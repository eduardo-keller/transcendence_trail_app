# Dados de trilhas

> Última atualização: 2026-10-17. Substitui a pesquisa de 2026-10-01 (versão completa na tag `docs-v1`).

## O que temos

O catálogo vem do **OpenStreetMap**, no retângulo `-24.05, -47.10, -23.00, -46.20` (Grande SP, Cantareira, Jaraguá, Serra do Japi, Atibaia, Mairiporã, Paranapiacaba e parte da Serra do Mar). O OSM quase não tem rotas de caminhada prontas na região, então o catálogo foi **montado agrupando vias com nome** (`highway=path|footway|track`): 4.439 vias viraram 3.878 trilhas.

| Arquivo | O que é |
|---|---|
| [`trilhas_20261007.sqlite`](../apps/web/prisma/data/trilhas_20261007.sqlite) | O dataset: tabelas `trilhas` (3.878), `ways` (4.439) e `trilha_ways` (qual via pertence a qual trilha) |
| [`import-trails.mts`](../apps/web/prisma/import-trails.mts) | Carrega a tabela `trilhas` em `Trail` |
| `prisma/data/gpx/` | 3.878 GPX, um por trilha. Nenhum código usa |

**Importar:** acontece sozinho no start do container quando ainda não há trilhas do OSM. `make import-trails` atualiza (upsert por `externalId`; não duplica).

Cada trilha traz: distância, desnível (ganho e perda), tempo estimado, se é circular, dificuldade (calculada; do `sac_scale` do OSM em 23 trilhas), percurso em GeoJSON, ponto inicial e algumas tags do OSM.

## Números

| Critério | Trilhas |
|---|---|
| Todas | 3.878 |
| 500 m ou mais | 214 |
| 500 m ou mais **e** nome com "Trilha", "Caminho", "Pico", "Cachoeira" ou "Pedra" | 88 |
| 1 km ou mais | 126 |
| 3 km ou mais | 32 |

Hoje 94% das trilhas têm menos de 500 m e muitas são vielas ("Viela H", "Travessa do Café"). Só o comprimento não basta: entre as de 500 m ou mais sem esse nome, muitas são ruas e estradas ("Estrada Municipal 20", "Rua Iporanga"). O SQLite já marca quem tem o nome (`nome_bate_regex`), mas a importação não lê essa coluna.

## Pendências

Do dono do catálogo, com o Gabs:
- [ ] **Filtro:** aplicar na importação (ex.: 500 m ou mais e nome de trilha) e apagar do banco as trilhas do OSM que não passam. O upsert não apaga nada sozinho.
- [ ] **Script gerador:** o que produziu o SQLite não está no repo. Sem ele, ninguém reproduz os dados nem explica na avaliação como eles foram obtidos.
- [ ] **Elevação:** 86% das trilhas têm desnível 0 (44 entre as de 500 m ou mais). Documentar a fonte, porque a licença e a atribuição dependem dela, e conferir 5 trilhas conhecidas (ex.: Pico do Jaraguá, Pedra Grande). Com modelo de elevação de 90 m, uma diferença de ±20% é normal.
- [ ] **Dificuldade:** documentar a fórmula usada, porque a página da trilha precisa explicar o critério. A pesquisa propunha: `sac_scale` quando existe; senão, `esforço = km + desnível_m / 100` (até 6 fácil, até 14 moderada, acima difícil).
- [ ] **GPX:** manter uns 5 como exemplo (testes, importação) e apagar o resto.

## Regras

- Nada de Overpass, Open-Meteo ou outra API em tempo de execução: tudo vem do arquivo versionado. A API pública do Overpass é instável (deu 504 várias vezes na pesquisa).
- O desnível é estimado: a tela deve dizer isso.
- Coordenadas em GeoJSON são `[lon, lat]`; o Leaflet usa `[lat, lon]`. Converta na borda.
- Nunca use dados do Wikiloc, AllTrails ou similares: os termos de uso proíbem.

## Mapa e licenças

| Item | Atenção |
|---|---|
| Dados do OSM (ODbL) | "© OpenStreetMap contributors" com link no mapa, no rodapé, nos Termos e no README. O dataset derivado também fica sob ODbL |
| Tiles do OSM | [Política de uso](https://operations.osmfoundation.org/policies/tiles/): atribuição visível, User-Agent e Referer válidos, **proibido baixar tiles em massa ou antecipadamente para uso offline**. Para o PWA: confira a política antes de guardar tiles no service worker |
| OpenTopoMap | Visual topográfico, bom para trilhas; CC-BY-SA; servidor comunitário (pode ficar lento) |
| Tile com erro | Vira erro no console. O provedor de tiles deve ser configurável por variável |
| Elevação | Atribuição depende da fonte (pendente) |
| Wikipedia (corpus do RAG) | CC BY-SA: citar o artigo e o link na resposta |
