# ADR-015: VectorDb começa em pgvector

**Status:** Accepted — 2026-07-26

## Problema
Knowledge Engine (RAG) e Business Graph precisam de busca por similaridade. Bancos vetoriais dedicados (Pinecone, Weaviate, Qdrant) são poderosos, mas adicionam infra separada, custo mensal e complexidade operacional.

## Alternativas consideradas
1. **Pinecone/Qdrant desde o início** — overengineering; custo fixo alto.
2. **pgvector** (extensão Postgres) — mesma stack, zero infra extra, performance suficiente até milhões de vetores.
3. **Busca sem embeddings** (full-text) — perde qualidade semântica; Lu vira dumb.

## Decisão
`VectorDb port` implementado sobre **pgvector** (mesmo Postgres). Índice HNSW para latência baixa. Migração para banco dedicado só sob **dor mensurada** (latência > 500ms P95 em busca ou > 10M vetores).

## Consequências (+)
- Zero infra nova. Zero custo extra.
- Backup/restore junto com dados relacionais.
- Transações ACID entre embedding e metadata.

## Consequências (–)
- Performance limitada acima de ~10M vetores por índice.
- Compute do embedding consome resources do Postgres em bulk insert.

## Impacto futuro
Se algum estúdio atingir volume que dói, migração para Qdrant/Pinecone via port sem tocar em Domain/Engines.
