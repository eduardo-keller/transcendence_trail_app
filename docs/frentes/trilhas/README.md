# F4: Trilhas & Mapas

> Última atualização: 2026-10-01 — escopo inicial.

| | |
|---|---|
| **Dono** | *a definir* (sugestão: PO, porque esta frente é o coração do produto) |
| **Apoio** | *a definir* |
| **Módulos** | Busca avançada (1); produto: Home, Trilhas e mapa, Detalhe, trilhas realizadas e ranking; fornece os dados para o RAG |
| **Status** | ⬜ não iniciado |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Transformar dados do OpenStreetMap num **catálogo de trilhas navegável**: lista, mapa, busca e detalhe com percurso, distância, desnível e perfil de elevação. Também registrar as trilhas que cada usuário fez. É a frente que dá cara de "Wikiloc" ao projeto.

## 2. Escopo

**Dentro:**
- **Pipeline de ingestão** (CLI no serviço `trails`) e **seed versionado**, conforme [research/osm-trilhas.md](../../research/osm-trilhas.md) e [ADR-0006](../../adr/0006-dados-de-trilhas-osm.md).
- **Serviço `trails`** (Fastify + Prisma + SQL PostGIS): busca, detalhe, lote, exportação para GPX, exportação para o RAG; carga do seed no start; publica `trail.catalog.updated`.
- **Páginas no `web`:** Home `/`; `/trilhas` (cards + mapa + filtros); `/trilhas/[slug]` (mapa do percurso, estatísticas, perfil de elevação, POIs, "marcar como realizada", "baixar GPX", "perguntar ao assistente", aviso de segurança e atribuições); `/ranking`.
- **Trilhas realizadas** (no `web`, `trails.prisma`): registrar, editar e excluir (data, nota, GPX opcional via upload da F2); estatísticas do perfil (total de trilhas, km, desnível acumulado); ranking geral e entre amigos; notificações conforme a matriz.

**Fora:** trilhas criadas por usuários a partir de GPX (extra, só depois do M2); previsão do tempo (extra); avaliações e notas de trilhas.

## 3. Critérios de aceite

Os critérios do módulo 8 estão em [MODULES.md](../../MODULES.md#8-busca-avançada-minor). Além deles:
- [ ] Catálogo carregado a partir do seed do repositório **sem acesso à internet** no start.
- [ ] Toda trilha tem nome, geometria, comprimento, desnível estimado, dificuldade e tipo (circular/linear).
- [ ] Mapa e lista sincronizados (passar o mouse no card destaca a trilha no mapa; mover o mapa pode filtrar a lista).
- [ ] Detalhe com o perfil de elevação (gráfico) e o rótulo "estimado".
- [ ] Atribuição do OSM visível no mapa; Copernicus/Open-Meteo na página da trilha.
- [ ] IDs de trilha **estáveis entre recargas do seed** (os registros de trilhas realizadas não podem quebrar).
- [ ] Nenhum erro no console: Leaflet só no cliente, tiles sem bloqueio, sem warning de hydration.

## 4. Desenho

### Dados (banco `trails`)

| Modelo | Campos principais | Observações |
|---|---|---|
| Trail | id (**determinístico**: UUID v5 dos IDs OSM de origem), slug, name, description?, source (`osm_relation`/`osm_ways`), osmRefs (json), geom `MultiLineString 4326`, geomSimplified, startPoint `Point`, lengthM, elevationGainM, elevationLossM, minEleM, maxEleM, elevationProfile (json), difficulty (`easy`/`moderate`/`hard`), difficultySource, routeType (`loop`/`linear`), surface?, municipality?, protectedArea?, tags (jsonb), createdAt, updatedAt | Índices: GiST em `geom` e `startPoint`; GIN trigram em `name`; btree em `lengthM`, `elevationGainM`, `difficulty` |
| Poi | id, osmId, kind (`peak`/`waterfall`/`viewpoint`), name, ele?, point, wikidata? | POIs próximos no detalhe e no corpus do RAG |
| IngestionRun | id, seedVersion, bbox, trailCount, startedAt, finishedAt, notes | Controla a recarga do seed |

**Banco `web`** (`trails.prisma`, schema desta frente):

| Modelo | Campos | Observações |
|---|---|---|
| TrailCompletion | id, userId, trailId, completedOn (date), notes?, gpxFileId?, trailNameSnapshot, lengthMSnapshot, elevationGainMSnapshot, createdAt, updatedAt | **Snapshot**: ranking e estatísticas sem chamar o `trails` |

### API

Busca: `GET /v1/trails`

| Parâmetro | Exemplo | Observação |
|---|---|---|
| `q` | `cachoeira` | Similaridade trigram no nome, município e parque |
| `difficulty` | `easy,moderate` | Múltiplos valores |
| `minLengthKm`, `maxLengthKm` | `2`, `8` | |
| `minGainM`, `maxGainM` | `0`, `400` | |
| `routeType` | `loop` | |
| `municipality` | `Mairiporã` | |
| `near` + `radiusKm` | `-23.45,-46.61` + `20` | `ST_DWithin` com geography |
| `bbox` | `w,s,e,n` | Área visível do mapa (`&&` + GiST) |
| `sort` + `order` | `length` + `asc` | `relevance`, `length`, `gain`, `name`, `distance` (exige `near`) |
| `page`, `pageSize` | `1`, `20` | Máximo de 50 |

Resposta: `{ items: TrailSummary[], page, pageSize, total }`. `TrailSummary` = id, slug, name, lengthM, elevationGainM, difficulty, routeType, municipality, startPoint.

Outras rotas: `GET /v1/trails/:idOrSlug` (detalhe + GeoJSON simplificado + perfil + POIs em 300 m), `GET /v1/trails/batch?ids=`, `GET /v1/trails/:id/gpx`, `GET /v1/trails/export` (para a F5). Catálogo em [contracts/README.md](../../contracts/README.md#trails-f4).

### UI
- `/trilhas`: filtros num painel (no mobile, numa gaveta); todos os filtros em `searchParams`; a lista é renderizada no servidor (Server Component chamando o `trails`); o mapa é um Client Component com marcadores nos pontos de início e destaque da trilha ao passar o mouse; estados de carregando, vazio e erro.
- `/trilhas/[slug]`: mapa com a linha, início e fim marcados; cartões de estatística; gráfico de elevação (Recharts) sincronizado com o mapa (opcional: passar o mouse no gráfico mostra o ponto no mapa); POIs; ações.

### Eventos
- `trail.catalog.updated` → `ai` (reindexar), publicado quando o `trails` carrega um seed novo.
- `notification.requested` nas ações de trilha realizada (ver a [matriz](../social/README.md#matriz-de-notificações)).

## 5. Dependências

| Fornece para | O quê | Quando |
|---|---|---|
| Todas | **Seed v0** com trilhas reais (desbloqueia UI, F5 e demos) | Sprint 0 (spike) |
| F5 | `GET /v1/trails/export` + evento `trail.catalog.updated` | M1 |
| F2 | Estatísticas do perfil e cards de trilha nos posts | M2 |

| Consome de | O quê | Enquanto não estiver pronto |
|---|---|---|
| F1 | Template de serviço, PostGIS | — |
| F2 | Auth; upload de GPX | Seed de usuários; GPX entra por último (é cortável) |
| F3 | Notificações | Publicar o evento assim mesmo |

## 6. Conceitos-chave

> 💡 **GeoJSON.** O formato JSON padrão para geometrias: `Point`, `LineString`, `MultiLineString`, `Polygon`, com coordenadas na ordem **[longitude, latitude]** (o contrário do que muita gente espera, e uma fonte clássica de bugs). O Leaflet usa `[lat, lng]`: converta na borda.

> 💡 **geometry × geography no PostGIS.** `geometry` faz cálculos num plano (rápido, mas em graus quando o SRID é 4326). `geography` calcula sobre a esfera da Terra, em metros (mais lento, porém correto). Guarde em `geometry(…, 4326)` e faça cast para `::geography` ao medir distâncias e comprimentos.

> 💡 **Índice espacial (GiST).** Sem índice, "trilhas dentro desta área" compara com todas as trilhas. O GiST indexa os retângulos envolventes: o operador `&&` (intersecção de bounding box) e o `ST_DWithin` usam o índice e descartam quase tudo rapidamente.

> 💡 **Simplificação.** Uma trilha pode ter milhares de pontos. Para o mapa, `ST_Simplify` (Douglas–Peucker) remove pontos quase alinhados e deixa o GeoJSON bem menor, quase sem diferença visual. Guarde a versão simplificada.

> 💡 **Paginação offset × cursor.** `OFFSET 40 LIMIT 20` é simples e permite "ir para a página 3" (bom para busca com total). Cursor (`WHERE id > último`) é mais eficiente e estável para feeds infinitos. Aqui usamos offset.

> 💡 **Estado na URL.** Filtros em `?difficulty=easy&page=2` tornam a busca compartilhável, funcionam com voltar/avançar e permitem renderizar no servidor. No Next.js, a página lê `searchParams` e os filtros atualizam a URL (`router.replace`).

> 💡 **Desnível e ruído.** Veja [research/osm-trilhas.md §5](../../research/osm-trilhas.md#5-elevação-e-desnível): suavizar + limiar, e mostrar "estimado".

Estudo: [PostGIS Workshop](https://postgis.net/workshops/postgis-intro/) · [OSM Map Features](https://wiki.openstreetmap.org/wiki/Map_features) · [Overpass Turbo](https://overpass-turbo.eu) · [React Leaflet](https://react-leaflet.js.org) · [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)

## 7. Backlog inicial (sementes para issues)

**M0 (spike, timebox de 2–3 dias)**
- [ ] Script v0: Overpass → staging PostGIS → agrupamento → comprimento → GeoJSON
- [ ] Elevação via Open-Meteo em 5 trilhas + validação
- [ ] Seed v0 (20–50 trilhas) commitado
- [ ] Serviço `trails` a partir do template + carga do seed + `GET /v1/trails` simples
- [ ] `/trilhas` listando cards (sem filtros ainda)

**M1**
- [ ] Pipeline completo (POIs, município, parque, dificuldade, tipo, perfil) + seed final + IDs determinísticos
- [ ] Recarga do seed por versão + evento `trail.catalog.updated`
- [ ] `/trilhas` com mapa (Leaflet só no cliente, provedor de tiles configurável)
- [ ] `/trilhas/[slug]` com mapa, estatísticas, perfil de elevação e atribuições
- [ ] `GET /v1/trails/export` para a F5

**M2**
- [ ] Busca avançada completa (filtros, ordenações, paginação, URL, validação)
- [ ] Trilhas realizadas (CRUD) + GPX opcional + estatísticas no perfil
- [ ] Ranking (geral e entre amigos)
- [ ] Home final
- [ ] Exportar GPX
- [ ] Métrica `trails_search_duration_seconds`

**M3**
- [ ] Teste de desempenho da busca (p95 < 300 ms)
- [ ] Revisão de console e acessibilidade (lista como alternativa ao mapa, teclado)
- [ ] Testes do cálculo de desnível e de dificuldade (unitários)

## 8. Riscos específicos

- **Catálogo pequeno** (R3): ampliar o retângulo; incluir vias sem "Trilha" no nome dentro de áreas protegidas; não fingir cobertura.
- **Overpass instável:** cache local da resposta bruta; plano B com a Geofabrik.
- **Prisma sem tipos espaciais:** `Unsupported` + `$queryRaw`; encapsule o SQL num repositório (`trailsRepository.search(...)`) para manter o resto do código limpo.
- **Tiles bloqueados → erro no console:** provedor configurável; User-Agent/Referer corretos.
- **GeoJSON grande no detalhe:** use a geometria simplificada.

## 9. Como demonstrar

1. `/trilhas`: filtro "moderada" + 3–8 km + "perto de Mairiporã" → ordenar por desnível → página 2 → copiar a URL para outra aba (mesmo resultado).
2. Mover o mapa → a lista acompanha a área visível.
3. Detalhe: percurso no mapa, perfil de elevação, POIs, baixar GPX.
4. "Marcar como realizada" → estatísticas do perfil e ranking atualizados → amigo recebe notificação.
5. Explicar o pipeline (do OSM ao seed) e uma query PostGIS.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| | | |

## 11. Estado atual

Nada implementado ainda. Pesquisa preliminar concluída: [research/osm-trilhas.md](../../research/osm-trilhas.md).
