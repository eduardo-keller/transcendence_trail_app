# ADR-0006: Dados de trilhas com ingestão offline do OSM e seed versionado

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** F4 (implementa), F5 (consome para o RAG)

## Contexto

Pesquisa em [research/osm-trilhas.md](../research/osm-trilhas.md). Pontos principais:
- Só **10** relações `route=hiking|foot` na região; o catálogo precisa ser montado também a partir de **vias nomeadas** (`highway=path|footway|track`): 64 grupos com 1 km ou mais.
- O OSM **não tem elevação** nas vias; o desnível exige um modelo digital de elevação (DEM).
- A API pública do Overpass respondeu **504** várias vezes durante a pesquisa: não dá para depender dela em tempo de execução nem na avaliação.
- A licença ODbL exige atribuição, e a base derivada fica sob ODbL.

## Decisão

1. **Ingestão offline** por script do serviço `trails` (CLI): Overpass com retry e backoff e cache da resposta bruta. Plano B: extrato da Geofabrik (`sudeste-latest.osm.pbf`) recortado com osmium.
2. **Processamento no PostGIS:** carregar as vias em tabela de staging; agrupar por nome e proximidade (`ST_ClusterDBSCAN`); unir (`ST_LineMerge`); calcular comprimento (`geography`); simplificar para exibição.
3. **Elevação** via Open-Meteo Elevation API (Copernicus DEM GLO-90, até 100 pontos por chamada, sem chave para uso não comercial), com amostragem ao longo da trilha, suavização e limiar para o desnível.
4. **Dificuldade calculada** a partir de distância e desnível (com `sac_scale` quando existir).
5. **Seed versionado no repo** (`services/trails/seed/`, GeoJSON comprimido). O container carrega o seed se o banco estiver vazio. **Nenhuma dependência do Overpass ou do Open-Meteo em runtime.**
6. Atribuição "© OpenStreetMap contributors" no mapa, no rodapé, nos Termos e no README; Copernicus e Open-Meteo na página da trilha e no README.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Consultar o Overpass em tempo real | Dados sempre atuais | Instável (504), lento, limitado; arrisca o dia da avaliação |
| Raspar Wikiloc ou AllTrails | Muitas trilhas | Proibido pelos termos de uso; antiético |
| Só trilhas enviadas por usuários (GPX) | Modelo do Wikiloc | Catálogo vazio no início |
| Tiles DEM locais (Copernicus GLO-30 + `geotiff`) | Offline, 30 m de resolução | Mais trabalho; fica como plano B se a Open-Meteo falhar |

## Consequências

**Positivas:** a avaliação não depende de serviço externo para os dados; o processamento geoespacial vira aprendizado de PostGIS; o seed é reprodutível.

**Negativas:** os dados ficam "congelados" na data da ingestão (aceitável); o catálogo é modesto (dezenas a poucas centenas de trilhas); o desnível é estimado (DEM de 90 m).

## 💡 Para aprender

- Modelo de dados do OSM: nodes, ways, relations, tags. <https://wiki.openstreetmap.org/wiki/Map_features>
- Overpass QL. <https://wiki.openstreetmap.org/wiki/Overpass_API>
- DEM e por que o desnível acumulado é sensível a ruído.
- Licença ODbL. <https://www.openstreetmap.org/copyright>
