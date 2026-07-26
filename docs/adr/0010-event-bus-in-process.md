# ADR-010: Event Bus in-process preparado para persistente

**Status:** Accepted — 2026-07-26

## Problema
Precisamos de eventos tipados agora, mas não temos volume que justifique Kafka/PGMQ. Ao mesmo tempo, se o contrato for feito só para in-process, migrar depois é dor.

## Alternativas consideradas
1. **Só in-process** (EventEmitter Node) — rápido de fazer; migração cara depois.
2. **Kafka/PGMQ desde o início** — overengineering; overhead operacional pesado.
3. **In-process com contrato compatível** com bus persistente — implementação simples hoje, migração transparente amanhã.

## Decisão
Event Bus in-process (`src/shared/event-bus/`) com contrato `publish(name, payload) → Promise` e `subscribe(name, handler) → unsubscribe`. Payloads tipados via declaration merging em `LunariEvents`. Contrato preparado para trocar implementação por PGMQ/Kafka sem afetar consumidores. Não emitir eventos síncronos que dependam de resposta — sempre fire-and-forget.

## Consequências (+)
- Zero overhead operacional hoje.
- Testabilidade máxima (bus mockável trivialmente).
- Migração para persistente = trocar 1 arquivo de implementação.

## Consequências (–)
- Sem retry automático hoje — handlers falhos perdem eventos (mitigado por log obrigatório).
- Sem replay histórico — Observation depende de estar rodando quando evento ocorre.

## Impacto futuro
Quando volume justificar (Onda 8+ com Observation ativa), trocar por PGMQ (mesma stack Postgres) sem tocar em publishers/subscribers.
