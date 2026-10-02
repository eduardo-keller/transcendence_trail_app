# Pesquisa: trilhas do OpenStreetMap na região de São Paulo

> Última atualização: 2026-10-01 — pesquisa inicial feita durante o planejamento.
> Próximo passo: **spike da F4 no Sprint 0** (seção 8).

## 1. Valeu pesquisar agora?

**Sim, de forma rápida.** A pesquisa mudou decisões de arquitetura e de produto:

1. **O OSM quase não tem "trilhas" como objetos prontos na região:** só 10 relações de rota de caminhada. O catálogo precisa ser **montado** a partir de vias soltas. Isso define o pipeline e o esforço da F4.
2. **O OSM não tem altitude** nas trilhas. "Desnível" (uma das informações principais da página) exige uma fonte extra, o que define uma dependência externa.
3. **A API pública do Overpass é instável** (vários erros 504 durante a pesquisa). Logo, os dados precisam ser pré-processados e versionados, nunca consultados em tempo real. Isso virou a [ADR-0006](../adr/0006-dados-de-trilhas-osm.md).
4. **O catálogo será modesto** (dezenas a poucas centenas de trilhas), o que ajusta a expectativa do produto e o risco R3.

O resto (limiares, fórmula de dificuldade, qualidade de cada trilha) é para o spike da F4, que vai ter o código rodando.

## 2. Conceitos: como o OSM organiza os dados

> 💡 O OSM tem três tipos de elementos:
> - **node:** um ponto (lat/lon). Ex.: um pico, uma cachoeira.
> - **way:** uma sequência ordenada de nodes. Ex.: um trecho de trilha, uma rua, o contorno de um parque.
> - **relation:** um grupo de elementos com papéis. Ex.: uma rota de caminhada formada por várias ways.
>
> Todo elemento tem **tags** `chave=valor` que dizem o que ele é. Não existe schema fixo: as tags seguem convenções da comunidade documentadas na [wiki](https://wiki.openstreetmap.org/wiki/Map_features), e cada mapeador pode tagear de um jeito, o que torna a qualidade irregular.

Tags relevantes para trilhas:

| Tag | Significado | Observação |
|---|---|---|
| `highway=path` | Caminho genérico para pedestres e bicicletas | O tipo mais comum de trilha |
| `highway=footway` | Caminho para pedestres | Muito usado em parques urbanos (gera ruído) |
| `highway=track` | Estrada de terra ou rural | Algumas trilhas usam |
| `route=hiking` / `route=foot` (relação) | Rota de caminhada nomeada | Ideal, mas rara na região |
| `name` | Nome | Essencial para virar "trilha" no catálogo |
| `sac_scale` | Dificuldade (escala suíça SAC) | Raro aqui |
| `trail_visibility` | Visibilidade da trilha | Raro |
| `surface` | Superfície (`ground`, `dirt`, `rock`…) | Presente em ~60% das vias nomeadas |
| `natural=peak` + `ele` | Pico com altitude | Útil para o RAG e o mapa |
| `waterway=waterfall`, `tourism=viewpoint` | Cachoeira, mirante | Pontos de interesse |
| `boundary=protected_area`, `leisure=nature_reserve` | Parques e reservas | Contexto: "trilha dentro do PE da Cantareira" |
| `wikidata`, `wikipedia` | Links para o artigo | Ponte para o corpus do RAG |

## 3. O que encontramos (consultas Overpass em 2026-10-01)

Retângulo consultado (sul, oeste, norte, leste): `-24.05, -47.10, -23.00, -46.20`.

| Consulta | Resultado |
|---|---|
| Relações `route=hiking\|foot` | **10** (3 sem nome; algumas urbanas, como "Trilha do Rio Pinheiros"; uma de 58 km marcada "em análise") |
| Vias `highway=path` com `name` | **480** |
| Vias `path\|footway\|track` com nome contendo Trilha, Caminho, Pico, Cachoeira ou Pedra | **259** vias, **161** nomes distintos |
| … agrupadas por nome | **64 trilhas ≥ 1 km**, **21 trilhas ≥ 3 km** |
| Vias `path\|footway\|track` com `sac_scale` | **70** no retângulo todo (47 das 259 nomeadas) |
| Todas as `highway=path` (sem filtro) | A consulta estourou o timeout (dezenas de milhares, a maioria sem nome) |
| POIs e áreas protegidas | Não concluído: o servidor respondeu 504 repetidas vezes |

Exemplos de trilhas montadas por agrupamento de nome (comprimento somado):

| Trilha | Comprimento | Segmentos |
|---|---|---|
| Trilha Caucáia do Alto | 15,7 km | 4 |
| Trilha da Cachoeira do Funil | 9,7 km | 3 |
| Trilha Mata Dentro | 9,1 km | 2 |
| Trilha Itaim Interparques | 9,1 km | 5 |
| Trilha Cachoeira da Siderúrgica | 8,0 km | 1 |
| Trilha do Vale do Rio Mogi | 5,7 km | 2 |
| Trilha do Pai Mathias | 3,3 km | 1 |
| Trilha para a Cachoeira da Fumaça | 3,2 km | 11 |
| Trilha Pedra Grande | 2,5 km | 8 |

**Conclusões:**
- Relações sozinhas não sustentam um catálogo. O pipeline precisa **agrupar vias nomeadas**.
- Nomes genéricos ("Trilha Azul", "Trilha 6 km", "Trilha de Caminhada") aparecem em lugares diferentes. Por isso o agrupamento precisa ser por **nome + proximidade**, não só por nome.
- **Dificuldade** quase nunca vem do OSM: precisa ser calculada.
- O tamanho realista do catálogo fica entre **~60 e ~200 trilhas**, dependendo dos filtros (ex.: incluir trilhas sem "Trilha" no nome dentro de áreas protegidas) e de ampliar o retângulo.

## 4. Pipeline de ingestão recomendado

Script CLI no serviço `trails` (ex.: `pnpm --filter trails ingest`), rodado **pelo time**, não pelo container em produção:

```
1. Baixar        Overpass (retry + backoff, User-Agent identificando o projeto) → cache JSON bruto em data/raw/ (no .gitignore)
                 Plano B: Geofabrik sudeste-latest.osm.pbf (~860 MB, atualização diária)
                          → osmium extract --bbox → osmium tags-filter → arquivo pequeno
2. Carregar      vias e relações em tabelas de staging no PostGIS (geometria LineString 4326 + tags JSONB)
3. Agrupar       relações: unir os membros. Vias: agrupar por nome normalizado + proximidade
4. Unir          ST_LineMerge(ST_Collect(geom)) → LineString ou MultiLineString
5. Filtrar       comprimento ≥ 500 m (configurável); descartar o que parecer urbano (opcional: exigir
                 interseção com área protegida ou com vegetação, ou ficar fora de área urbana)
6. Enriquecer    comprimento (geography), tipo (circular se início ≈ fim < 100 m), superfície,
                 município (polígonos admin_level=8 + ST_Intersects), parque (protected_area), POIs próximos
7. Elevar        amostrar um ponto a cada 25–50 m → Open-Meteo em lotes de 100 → perfil, desnível, mín./máx.
8. Classificar   dificuldade (seção 6)
9. Exportar      seed/trails.geojson.gz (versionado) + log da execução (IngestionRun)
```

Agrupamento por nome e proximidade no PostGIS (ideia, a validar no spike):

```sql
-- staging_ways(id, name_norm, geom geometry(LineString, 4326), tags jsonb)
WITH clustered AS (
  SELECT id, name_norm, geom,
         ST_ClusterDBSCAN(ST_Transform(geom, 31983), eps := 200, minpoints := 1)
           OVER (PARTITION BY name_norm) AS cluster_id   -- 200 m em SIRGAS 2000 / UTM 23S
  FROM staging_ways
)
SELECT name_norm, cluster_id,
       ST_LineMerge(ST_Collect(geom)) AS geom,
       ST_Length(ST_Collect(geom)::geography) AS length_m
FROM clustered
GROUP BY name_norm, cluster_id;
```

> 💡 **SRID 4326 × 31983.** 4326 (WGS 84) é latitude e longitude em graus: ótimo para guardar e para o mapa, ruim para medir (1 grau não é uma distância fixa). 31983 (SIRGAS 2000 / UTM 23S) é uma projeção em metros adequada para São Paulo. Para medir com precisão, use `::geography`; para clusterizar com distância em metros, projete.

Bibliotecas úteis em TypeScript: `osmtogeojson` (resposta do Overpass para GeoJSON, inclusive relações), `@turf/turf` (cálculos geométricos no cliente), `@tmcw/togeojson` (GPX para GeoJSON, para os uploads de usuários).

## 5. Elevação e desnível

**Fonte recomendada:** [Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api)
- Dados: Copernicus DEM GLO-90 (resolução de 90 m).
- Até **100 coordenadas por requisição**; sem chave para uso não comercial.
- Exige atribuição a Copernicus e Open-Meteo.
- Uso: `GET https://api.open-meteo.com/v1/elevation?latitude=-23.4,-23.41&longitude=-46.6,-46.61`
- Estimativa: 200 trilhas × ~150 pontos = ~30 mil pontos = ~300 requisições. É uma execução só, e o resultado vai para o seed.

**Plano B (offline, mais preciso):** baixar os tiles do Copernicus GLO-30 (30 m) da região (4 tiles de 1°×1°, disponíveis abertamente na AWS) e amostrar com a biblioteca `geotiff` em Node.

**Algoritmo de desnível:**
1. Amostrar pontos equidistantes ao longo da linha (`ST_LineInterpolatePoints` ou turf).
2. Obter a elevação de cada ponto.
3. **Suavizar** (média móvel de ~5 pontos), porque o DEM tem ruído.
4. Somar só as subidas e descidas acima de um **limiar** (histerese de ~3–5 m).
5. Guardar: `elevationGainM`, `elevationLossM`, `minEleM`, `maxEleM` e o perfil `[[distM, eleM], …]` (≤ 200 pontos, para o gráfico).

> 💡 **Por que suavizar?** Somar toda micro-variação de um DEM de 90 m infla o desnível (cada "degrau" do ruído conta como subida). O limiar ignora oscilações pequenas. O resultado é uma **estimativa**: a UI deve dizer isso.

**Validação:** comparar 5 trilhas conhecidas (Pico do Jaraguá, Pedra Grande na Cantareira, etc.) com valores de referência públicos. Diferenças de ±20% são esperadas.

## 6. Dificuldade (proposta inicial, calibrar no spike)

1. Se houver `sac_scale`: `hiking` → fácil; `mountain_hiking` → moderada; `demanding_mountain_hiking` ou acima → difícil.
2. Senão, "esforço equivalente": `esforço = distância_km + desnível_positivo_m / 100`.
   - ≤ 6 → **fácil** · ≤ 14 → **moderada** · > 14 → **difícil**.
3. Guardar `difficultySource` (`osm` ou `calculated`) e explicar o critério na página da trilha.

## 7. Mapas, tiles e licenças

| Item | Ponto de atenção |
|---|---|
| Tiles do OSM (`tile.openstreetmap.org`) | [Política](https://operations.osmfoundation.org/policies/tiles/): atribuição visível "© OpenStreetMap contributors"; User-Agent e Referer válidos; **proibido** pré-carregar, raspar ou oferecer uso offline; sem SLA. Aceitável para baixo tráfego. |
| OpenTopoMap | Visual topográfico (curvas de nível), ótimo para trilhas; CC-BY-SA; servidor comunitário (pode ficar lento) |
| Erros de tile | Um tile bloqueado gera **erro no console** (reprova). O provedor precisa ser configurável por variável de ambiente |
| ODbL (dados do OSM) | Atribuição obrigatória. O seed é uma "base derivada" e fica sob ODbL: declarar no README e nos Termos |
| Wikipedia (corpus do RAG) | CC BY-SA: citar o artigo e o link na fonte da resposta |
| Wikiloc / AllTrails | **Não usar**: os termos de uso proíbem extração |

## 8. Spike da F4 no Sprint 0 (timebox: 2–3 dias)

Objetivo: transformar esta pesquisa em código e números reais, e entregar um **seed v0** que desbloqueia as outras frentes.

- [ ] Script v0: Overpass → staging → agrupamento → comprimento → GeoJSON.
- [ ] Testar a Open-Meteo em 5 trilhas e validar o desnível contra referências.
- [ ] Decidir os limiares (comprimento mínimo, distância de agrupamento, critério urbano) olhando o resultado no mapa.
- [ ] Gerar o **seed v0** (20–50 trilhas) e commitar.
- [ ] Rodar as consultas de POIs e áreas protegidas que falharam (horário de menor carga ou outro endpoint Overpass).
- [ ] Registrar os números finais (tamanho do catálogo, distribuição de dificuldade) na seção "Decisões" da [frente Trilhas](../frentes/trilhas/README.md).

## 9. Consultas Overpass prontas

Teste em <https://overpass-turbo.eu> (visualiza no mapa) antes de usar no script.

```
// Relações de caminhada
[out:json][timeout:90];
relation["route"~"^(hiking|foot)$"](-24.05,-47.10,-23.00,-46.20);
out tags geom;
```

```
// Vias nomeadas com cara de trilha
[out:json][timeout:180];
way[highway~"^(path|footway|track)$"][name~"[Tt]rilha|[Cc]aminho|[Pp]ico|[Cc]achoeira|[Pp]edra"](-24.05,-47.10,-23.00,-46.20);
out tags geom;
```

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

Boas práticas com o Overpass: identificar o projeto no User-Agent; uma consulta por vez; esperar entre consultas; guardar a resposta em cache local; se der 429 ou 504, tentar mais tarde ou usar outro endpoint público.

## Fontes

- OSM Map Features: <https://wiki.openstreetmap.org/wiki/Map_features>
- Overpass API: <https://wiki.openstreetmap.org/wiki/Overpass_API>
- Hiking no OSM: <https://wiki.openstreetmap.org/wiki/Hiking>
- Política de tiles: <https://operations.osmfoundation.org/policies/tiles/>
- Copyright e ODbL: <https://www.openstreetmap.org/copyright>
- Open-Meteo Elevation API: <https://open-meteo.com/en/docs/elevation-api>
- Extratos Geofabrik (Brasil): <https://download.geofabrik.de/south-america/brazil.html>
