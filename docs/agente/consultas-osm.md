# Consultas ao OpenStreetMap

> Para o Edu (corpus do RAG) e para o filtro do catálogo. Os dados de trilhas que já existem estão descritos em [dados-trilhas.md](../dados-trilhas.md).
> Retiradas da pesquisa de 2026-10-01 (tag `docs-v1`). As duas primeiras **nunca rodaram até o fim** (o servidor devolveu 504).

**Para que servem:**
- **Pontos de interesse** (picos, cachoeiras, mirantes) e os links `wikidata`/`wikipedia`: volume e contexto para o corpus do RAG. Só 6 trilhas do dataset têm link para a Wikipedia.
- **Áreas protegidas:** filtro melhor que o nome para separar trilha de rua ("está dentro de um parque?"), e contexto para o RAG ("trilha no PE da Cantareira").

Teste em <https://overpass-turbo.eu> (mostra no mapa) antes de usar num script.

```
// Pontos de interesse nomeados
[out:json][timeout:180];
(
  node[natural=peak][name](-24.05,-47.10,-23.00,-46.20);
  node[waterway=waterfall][name](-24.05,-47.10,-23.00,-46.20);
  node[tourism=viewpoint][name](-24.05,-47.10,-23.00,-46.20);
);
out tags;
```

```
// Áreas protegidas (parques estaduais, APAs, reservas)
[out:json][timeout:180];
(
  relation[boundary=protected_area](-24.05,-47.10,-23.00,-46.20);
  relation[leisure=nature_reserve](-24.05,-47.10,-23.00,-46.20);
);
out tags geom;
```

```
// Relações de caminhada (10 na região em 2026-10-01)
[out:json][timeout:90];
relation["route"~"^(hiking|foot)$"](-24.05,-47.10,-23.00,-46.20);
out tags geom;
```

```
// Vias nomeadas com cara de trilha (a mesma busca por nome do dataset)
[out:json][timeout:180];
way[highway~"^(path|footway|track)$"][name~"[Tt]rilha|[Cc]aminho|[Pp]ico|[Cc]achoeira|[Pp]edra"](-24.05,-47.10,-23.00,-46.20);
out tags geom;
```

**Boas práticas:** identifique o projeto no User-Agent; uma consulta por vez, com espera entre elas; guarde a resposta em cache local; com 429 ou 504, tente mais tarde ou use outro endpoint público. Plano B se o Overpass não colaborar: extrato da Geofabrik (`sudeste-latest.osm.pbf`) recortado com `osmium`.

**Wikipedia:** a API do MediaWiki devolve o texto dos artigos (`action=query&prop=extracts`). Guarde o resultado no repo, como as trilhas: nada de chamar a API em tempo de execução.
