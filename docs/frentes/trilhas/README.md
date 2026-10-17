# F4: Trilhas & Mapas

> Última atualização: 2026-10-17 — alinhado ao código: trilhas e atividades vivem no `web` (schema atual), sem serviço `trails` separado.

| | |
|---|---|
| **Dono** | *a definir* (sugestão: PO, porque esta frente é o coração do produto) |
| **Apoio** | *a definir* |
| **Módulos** | Busca avançada (1); produto: Home, Trilhas e mapa, Detalhe, publicar trilha, atividades, ranking e emblemas; fornece os dados para o RAG |
| **Status** | ⬜ não iniciado (modelos já no schema) |
| **Planos** | [planos/](planos/) |

## 1. Objetivo

Montar um **catálogo de trilhas navegável**: lista, mapa, busca e detalhe com percurso, distância, desnível e dificuldade. O catálogo começa com trilhas do OpenStreetMap e cresce com as trilhas publicadas pelos usuários. Também registrar as atividades de cada usuário. É a frente que dá cara de "Wikiloc" ao projeto.

## 2. Escopo

**Dentro (tudo no `web`):**
- **Pipeline de ingestão do OSM** (script CLI em `apps/web/scripts/`, rodado pelo time) e **seed versionado** carregado em `Trail`, conforme [research/osm-trilhas.md](../../research/osm-trilhas.md) e [ADR-0006](../../adr/0006-dados-de-trilhas-osm.md).
- **Trilhas:** publicar a partir de GPX (com o upload da F2), editar, excluir, visibilidade `PUBLIC`/`PRIVATE`.
- **Busca:** Route Handler `GET /api/trails` e Server Components das páginas, com filtros, ordenação e paginação.
- **Páginas:** Home `/`; `/trilhas` (cards + mapa + filtros); `/trilhas/[id]` (mapa do percurso, estatísticas, autor, "registrar atividade", "perguntar ao assistente", aviso de segurança e atribuições); `/trilhas/nova`; `/atividades/nova`; `/ranking`.
- **Atividades:** registrar, editar e excluir; estatísticas do perfil (total de atividades, km, tempo); ranking geral e entre amigos.
- **Emblemas:** regras de concessão a partir das atividades (`Badge`, `UserBadge`).
- **Exportação para o RAG:** `GET /api/internal/trails/export` + evento `trail.catalog.updated`.
- Notificações conforme a matriz.

**Fora:** previsão do tempo (extra); avaliações e notas de trilhas; gravação de GPS ao vivo.

## 3. Critérios de aceite

Os critérios do módulo 8 estão em [MODULES.md](../../MODULES.md#8-busca-avançada-minor). Além deles:
- [ ] Catálogo do OSM carregado a partir do seed do repositório, **sem acesso à internet** no start.
- [ ] Toda trilha tem título, percurso (`routeGeoJSON`), bounding box, distância, desnível e dificuldade.
- [ ] Trilha `PRIVATE` nunca aparece na busca nem no detalhe para quem não é o autor (checado no servidor).
- [ ] Mapa e lista sincronizados (passar o mouse no card destaca a trilha no mapa; mover o mapa pode filtrar a lista).
- [ ] Desnível marcado como "estimado" quando vier do DEM.
- [ ] Atribuição do OSM visível no mapa; Copernicus/Open-Meteo na página da trilha.
- [ ] Recarregar o seed não duplica trilhas nem quebra as atividades que apontam para elas.
- [ ] Nenhum erro no console: Leaflet só no cliente, tiles sem bloqueio, sem warning de hydration.

## 4. Desenho

### Dados (banco principal, `apps/web/prisma/schema.prisma`, seção `trails`)

**Existe:**

| Modelo | Campos | Observações |
|---|---|---|
| Trail | id (`cuid`), title, description?, distance (m), elevationGain (m), difficulty (`EASY`/`MODERATE`/`HARD`, padrão `MODERATE`), visibility (`PUBLIC`/`PRIVATE`, padrão `PUBLIC`), routeGeoJSON (JSON), minLat, minLon, maxLat, maxLon, authorId, createdAt, updatedAt | Índice em `authorId`. Autor apagado → trilhas apagadas (cascata) |
| Activity | id (`cuid`), title, distance (m), duration (s), polyline?, startedAt, userId, trailId?, createdAt | Índices em `userId` e `trailId`. Trilha apagada → `trailId` nulo |
| Badge / UserBadge | Badge: name (único), description, iconUrl. UserBadge: userId, badgeId, earnedAt | `UNIQUE(userId, badgeId)` |

**Campos a adicionar quando a funcionalidade precisar** (com migration): perfil de elevação (`elevationProfile` JSON) e desnível negativo para o gráfico; tipo circular/linear; município; referência à origem no OSM (para recarregar o seed sem duplicar); índices em `distance`, `elevationGain` e `difficulty` para a busca.

### API

Busca: `GET /api/trails` (e a mesma lógica chamada direto pelo Server Component de `/trilhas`). Retorna só trilhas `PUBLIC` e as `PRIVATE` do próprio usuário.

| Parâmetro | Exemplo | Observação |
|---|---|---|
| `q` | `cachoeira` | Texto em `title` e `description` (`contains`, sem diferenciar maiúsculas; `pg_trgm` se precisar tolerar erros de digitação) |
| `difficulty` | `EASY,MODERATE` | Múltiplos valores |
| `minDistanceKm`, `maxDistanceKm` | `2`, `8` | Convertidos para metros |
| `minGainM`, `maxGainM` | `0`, `400` | |
| `bbox` | `w,s,e,n` | Área visível do mapa: interseção com `minLat…maxLon` |
| `near` + `radiusKm` | `-23.45,-46.61` + `20` | Vira um bbox em volta do ponto |
| `author` | `me` | Minhas trilhas |
| `sort` + `order` | `distance` + `asc` | `distance`, `elevationGain`, `title`, `createdAt` |
| `page`, `pageSize` | `1`, `20` | Máximo de 50 |

Resposta: `{ items: TrailSummary[], page, pageSize, total }`. `TrailSummary` = id, title, distance, elevationGain, difficulty, visibility, author (id, name), bbox.

Outras rotas: `GET /api/trails/:id` (detalhe com `routeGeoJSON`), criação, edição e exclusão por Server Actions; atividades por Server Actions; `GET /api/internal/trails/export` (para a F5). Catálogo em [contracts/README.md](../../contracts/README.md).

### UI
- `/trilhas`: filtros num painel (no mobile, numa gaveta); todos os filtros em `searchParams`; a lista é renderizada no servidor; o mapa é um Client Component com o início de cada trilha e destaque ao passar o mouse; estados de carregando, vazio e erro.
- `/trilhas/[id]`: mapa com a linha do `routeGeoJSON`, início e fim marcados; cartões de estatística; ações.
- `/trilhas/nova`: upload de GPX → converter para GeoJSON (ex.: `@tmcw/togeojson`) → calcular distância, bounding box e desnível → formulário com título, descrição, dificuldade e visibilidade.

### Eventos
- `trail.catalog.updated` → `ai` (reindexar), publicado quando um seed novo é carregado ou uma trilha pública muda.
- Notificações das ações de trilha, atividade e emblema (ver a [matriz](../social/README.md#matriz-de-notificações)).

## 5. Dependências

| Fornece para | O quê | Quando |
|---|---|---|
| Todas | **Seed v0** com trilhas reais (desbloqueia UI, F5 e demos) | Sprint 0 (spike) |
| F5 | `GET /api/internal/trails/export` + evento `trail.catalog.updated` | M1 |
| F2 | Estatísticas e emblemas no perfil | M2 |

| Consome de | O quê | Enquanto não estiver pronto |
|---|---|---|
| F1 | Banco com PostGIS (já existe), Redis | Publicar eventos depois |
| F2 | Auth; upload de GPX | Seed de usuários; GPX colado num formulário de dev |
| F3 | Entrega de notificações em tempo real | Gravar a `Notification` assim mesmo |

## 6. Conceitos-chave

> 💡 **GeoJSON.** O formato JSON padrão para geometrias: `Point`, `LineString`, `MultiLineString`, `Polygon`, com coordenadas na ordem **[longitude, latitude]** (o contrário do que muita gente espera, e uma fonte clássica de bugs). O Leaflet usa `[lat, lng]`: converta na borda.

> 💡 **Bounding box.** O menor retângulo que contém a trilha (`minLat`, `minLon`, `maxLat`, `maxLon`). Dois retângulos se cruzam quando um começa antes de o outro terminar, nos dois eixos. Guardar o bbox em colunas comuns deixa "trilhas nesta área do mapa" virar uma query simples e indexável, sem SQL espacial.

> 💡 **Distância sobre a esfera.** Coordenadas em graus não são metros. Para medir o comprimento de um percurso, some a distância entre pontos consecutivos com a fórmula de Haversine (ex.: `@turf/length`) ou, no PostGIS, `ST_Length(geom::geography)`.

> 💡 **Simplificação.** Um GPX pode ter milhares de pontos. Para o mapa, remover pontos quase alinhados (Douglas–Peucker: `@turf/simplify` ou `ST_Simplify`) deixa o GeoJSON bem menor, quase sem diferença visual.

> 💡 **Paginação offset × cursor.** `OFFSET 40 LIMIT 20` é simples e permite "ir para a página 3" (bom para busca com total). Cursor (`WHERE id > último`) é mais eficiente e estável para feeds infinitos. Aqui usamos offset.

> 💡 **Estado na URL.** Filtros em `?difficulty=EASY&page=2` tornam a busca compartilhável, funcionam com voltar/avançar e permitem renderizar no servidor. No Next.js, a página lê `searchParams` e os filtros atualizam a URL (`router.replace`).

> 💡 **Desnível e ruído.** Veja [research/osm-trilhas.md §5](../../research/osm-trilhas.md#5-elevação-e-desnível): suavizar + limiar, e mostrar "estimado".

Estudo: [OSM Map Features](https://wiki.openstreetmap.org/wiki/Map_features) · [Overpass Turbo](https://overpass-turbo.eu) · [React Leaflet](https://react-leaflet.js.org) · [Turf.js](https://turfjs.org) · [PostGIS Workshop](https://postgis.net/workshops/postgis-intro/) (para a ingestão)

## 7. Backlog inicial (sementes para issues)

**M0 (spike, timebox de 2–3 dias)**
- [ ] Script v0: Overpass → staging PostGIS → agrupamento → comprimento → GeoJSON + bbox
- [ ] Elevação via Open-Meteo em 5 trilhas + validação
- [ ] Seed v0 (20–50 trilhas) commitado + carga em `Trail` (com o autor do sistema)
- [ ] `/trilhas` listando cards (sem filtros ainda)

**M1**
- [ ] Pipeline completo (dificuldade, desnível) + seed final + recarga sem duplicar
- [ ] `/trilhas` com mapa (Leaflet só no cliente, provedor de tiles configurável)
- [ ] `/trilhas/[id]` com mapa, estatísticas e atribuições
- [ ] `GET /api/internal/trails/export` para a F5

**M2**
- [ ] Busca avançada completa (filtros, ordenações, paginação, URL, validação, visibilidade)
- [ ] Publicar trilha a partir de GPX + editar + excluir
- [ ] Atividades (CRUD) + estatísticas no perfil
- [ ] Ranking (geral e entre amigos)
- [ ] Emblemas concedidos por atividades
- [ ] Home final

**M3**
- [ ] Teste de desempenho da busca (p95 < 300 ms)
- [ ] Revisão de console e acessibilidade (lista como alternativa ao mapa, teclado)
- [ ] Testes do cálculo de distância, desnível e dificuldade (unitários)

## 8. Riscos específicos

- **Catálogo pequeno** (R3): ampliar o retângulo; incluir vias sem "Trilha" no nome dentro de áreas protegidas; não fingir cobertura. Trilhas de usuários ajudam a crescer.
- **Overpass instável:** cache local da resposta bruta; plano B com a Geofabrik.
- **`routeGeoJSON` grande:** simplifique antes de gravar; na lista, nunca mande o percurso, só o bbox.
- **GPX malicioso ou enorme:** validar o XML, limitar tamanho e número de pontos.
- **Tiles bloqueados → erro no console:** provedor configurável; User-Agent/Referer corretos.

## 9. Como demonstrar

1. `/trilhas`: filtro "moderada" + 3–8 km → ordenar por desnível → página 2 → copiar a URL para outra aba (mesmo resultado).
2. Mover o mapa → a lista acompanha a área visível.
3. Detalhe: percurso no mapa, estatísticas, autor.
4. Publicar uma trilha a partir de GPX como privada → outro usuário não a encontra.
5. Registrar uma atividade → estatísticas do perfil, ranking e emblema atualizados → amigo recebe notificação.
6. Explicar o pipeline (do OSM ao seed) e a query de busca por bbox.

## 10. Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-17 | Trilhas e atividades no banco do `web`, sem serviço `trails` | É o que o schema implementa (commits `6dde86b`, `7e2cb3f`) |
| 2026-10-17 | Percurso em `routeGeoJSON` (JSON) + bbox em colunas `Float` | Busca por área com Prisma puro; PostGIS fica para a ingestão |
| 2026-10-17 | Trilhas têm autor e visibilidade; `Activity` no lugar de "trilha realizada" | Modelo do schema atual (estilo Wikiloc) |

## 11. Estado atual

(2026-10-17)
- Pesquisa preliminar concluída: [research/osm-trilhas.md](../../research/osm-trilhas.md). Spike de ingestão e páginas não iniciados.
- Modelos `Trail`, `Activity`, `Badge` e `UserBadge` criados (migrations `20261017005754_init` e `20261017161143_better_auth_and_cleanup`).
- `GET /api/health` do `web` devolve a contagem de trilhas (`{ ok, trails }`).
