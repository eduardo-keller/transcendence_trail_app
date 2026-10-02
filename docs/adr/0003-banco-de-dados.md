# ADR-0003: PostgreSQL com um servidor e um banco por serviço; Prisma; PostGIS e pgvector

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

- O time escolheu PostgreSQL e o módulo de ORM.
- Microsserviços pedem isolamento de dados entre serviços.
- Trilhas são dados geoespaciais (linhas, distâncias, "perto de mim"). O RAG precisa de busca vetorial.
- As máquinas têm memória limitada (cerca de 15 containers).

## Decisão

- **Um container PostgreSQL** com **quatro bancos** (`web`, `realtime`, `trails`, `ai`) e **um usuário por banco**, com permissão só no próprio banco. Um script de init cria bancos, usuários e extensões.
- Imagem customizada a partir de `postgis/postgis` com o pacote do **pgvector** instalado.
- Extensões: `postgis` e `pg_trgm` em `trails`; `vector` em `ai`; `pg_trgm` em `web` (busca de comunidades).
- **Prisma** como ORM em todos os serviços com banco. No `web`, o schema é dividido em vários arquivos, um por domínio (recurso estável desde o Prisma 6.7; no Prisma 7 é configurado em `prisma.config.ts`).
- Tipos espaciais e vetoriais declarados como `Unsupported(...)` e consultados com `$queryRaw` (template tag, seguro). Nunca `$queryRawUnsafe` com entrada do usuário.
- Migrations aplicadas no start do container (`prisma migrate deploy`).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Um banco compartilhado entre serviços | Joins fáceis | Acoplamento; enfraquece a defesa do módulo de microsserviços |
| Um container Postgres por serviço | Isolamento máximo | ~4× a memória; mais backups e exporters |
| Drizzle ORM | Mais próximo do SQL; leve | Menos material de aprendizado; Prisma é mais pedido e tem schema muito legível (bom para o requisito de "schema claro") |
| Banco vetorial dedicado (Qdrant, Chroma) | Recursos avançados | Mais um container; o pgvector resolve o volume que teremos |

## Consequências

**Positivas:** isolamento defendível com custo de memória baixo; uma ferramenta de backup; PostGIS e pgvector no mesmo motor que o time já conhece.

**Negativas:** sem joins entre serviços (usar API ou snapshot); SQL puro nas partes espaciais e vetoriais (é preciso explicar o motivo na avaliação).

## 💡 Para aprender

- Database-per-service e consistência eventual.
- PostGIS: `geometry` × `geography`, SRID 4326, índices GiST. Workshop: <https://postgis.net/workshops/postgis-intro/>
- pgvector: distância de cosseno, índice HNSW. <https://github.com/pgvector/pgvector>
- Prisma: migrations, `Unsupported`, `$queryRaw`. <https://www.prisma.io/docs>
