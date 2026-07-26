# ADR-011: Business Graph como projeção derivada, não fonte

**Status:** Accepted — 2026-07-26

## Problema
Correlações cross-entidade (cliente ↔ sessão ↔ pagamento ↔ galeria) são caras em SQL relacional puro. Um banco de grafos dedicado seria overengineering para o volume atual.

## Alternativas consideradas
1. **Banco de grafos dedicado** (Neo4j, Neptune) — overhead operacional pesado, ROI baixo.
2. **Grafo como fonte** (Postgres com estrutura de grafo nativa) — perde relacional forte.
3. **Grafo como projeção derivada** — Postgres continua fonte; grafo é view materializada.

## Decisão
Business Graph é **projeção lida**, materializada via triggers/jobs em tabelas dedicadas (`graph_nodes`, `graph_edges`, `graph_projections`). Postgres relacional continua fonte da verdade. Se divergirem, Postgres vence; projeção é reconstruída. pgvector para similaridade. **Lint proíbe escrita direta na projeção fora dos jobs de reconstrução.**

## Consequências (+)
- Zero risco de inconsistência (projeção reconstruível).
- Habilita queries "clientes que compraram X também contrataram Y" sem código custom.
- Migração para banco de grafos dedicado (se necessário no futuro) é trivial.

## Consequências (–)
- Latência de projeção (jobs assíncronos podem atrasar segundos).
- Espaço em disco duplicado (aceitável até 100k clientes por estúdio).

## Impacto futuro
Só nasce quando primeira query cross-entidade justificar (Onda 14 condicional). Se demanda nunca surgir, nunca é construída — coerente com Evolução Progressiva.
