# ADR-0003: PostgreSQL com um servidor e um banco por serviço; Prisma; PostGIS e pgvector

- **Status:** Proposta (banco principal implementado)
- **Data:** 2026-10-01 (revista em 2026-10-17 para refletir o código)
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

- O time escolheu PostgreSQL e o módulo de ORM.
- Microsserviços pedem isolamento de dados entre serviços.
- Trilhas são dados geográficos (percursos, "perto de mim", área do mapa). O RAG precisa de busca vetorial.
- As máquinas têm memória limitada.

## Decisão

- **Um container PostgreSQL** (imagem própria em `docker/postgres/`: Alpine + PostgreSQL 18 + PostGIS + pgvector) com **um banco por serviço**:
  - **principal** (`POSTGRES_DB`, padrão `trails`), do `web`: **existe**. O entrypoint cria o banco e as extensões `postgis` e `vector` na primeira subida.
  - `realtime` e `ai`: criados quando os serviços existirem, cada um com um usuário com permissão só no próprio banco (hoje há um usuário só, `POSTGRES_USER`).
- Senha do banco como **Docker secret** (`docker/secrets/db_password.txt`), nunca no `.env`.
- **Prisma 7** como ORM em todos os serviços com banco, com `prisma.config.ts` e o driver adapter `@prisma/adapter-pg`. No `web`, hoje um único `schema.prisma` dividido por comentários; se os conflitos aumentarem, dividir em vários arquivos (suporte nativo do Prisma).
- **Trilhas sem tipo espacial no schema:** o percurso fica em `routeGeoJSON` (JSON) e a área em colunas `minLat`, `minLon`, `maxLat`, `maxLon`. A busca por área é feita com Prisma puro. O PostGIS fica disponível para a ingestão do OSM e para consultas especiais com `$queryRaw` (template tag, seguro). Nunca `$queryRawUnsafe` com entrada do usuário.
- **Vetores (banco `ai`):** `Unsupported("vector(384)")` no schema e `$queryRaw` nas buscas.
- Migrations aplicadas no start do container (`prisma migrate deploy`).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Um banco compartilhado entre todos os serviços | Joins fáceis | Acoplamento; enfraquece a defesa do módulo de microsserviços |
| Um container Postgres por serviço | Isolamento máximo | Multiplica a memória, os backups e os exporters |
| Geometria PostGIS no schema (`Unsupported("geometry")`) | Consultas espaciais completas e índice GiST | Toda leitura e escrita de trilha vira SQL puro; o bbox resolve a busca por área que precisamos |
| Drizzle ORM | Mais próximo do SQL; leve | Menos material de aprendizado; Prisma é mais pedido e tem schema muito legível (bom para o requisito de "schema claro") |
| Banco vetorial dedicado (Qdrant, Chroma) | Recursos avançados | Mais um container; o pgvector resolve o volume que teremos |

## Consequências

**Positivas:** isolamento defendível com custo de memória baixo; uma ferramenta de backup; o schema de trilhas é 100% Prisma; PostGIS e pgvector no mesmo motor.

**Negativas:** sem joins entre serviços (usar API); filtros espaciais mais elaborados (raio exato, interseção com o percurso e não só com o retângulo) exigem `$queryRaw` com `ST_GeomFromGeoJSON`.

## 💡 Para aprender

- Database-per-service e consistência eventual.
- Bounding box e por que ele é um filtro barato e aproximado.
- PostGIS: `geometry` × `geography`, SRID 4326. Workshop: <https://postgis.net/workshops/postgis-intro/>
- pgvector: distância de cosseno, índice HNSW. <https://github.com/pgvector/pgvector>
- Prisma: migrations, `Unsupported`, `$queryRaw`, driver adapters. <https://www.prisma.io/docs>
