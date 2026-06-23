# features/workflow

Refatoração em camadas da página Workflow. Ver `.lovable/plan.md` para o plano completo e o status de cada Onda.

## Camadas (alvo)
- `domain/` — tipos + funções puras (zero React, zero Supabase). **Onda 1 ✅**
- `data/` — repositórios Supabase, < 250 linhas cada. **Onda 2**
- `realtime/` — hook único multiplexado com sequence anti-eco. **Onda 3**
- `store/` — estado reativo + indexers + selectors + persistence. **Onda 1 (parcial)**
- `actions/` — `defineCommand` com Zod, idempotência, audit. **Onda 4**
- `queries/` — `defineQuery` com Zod, números (nunca strings de moeda). **Onda 4**
- `hooks/` — binding React fino. **Onda 5**
- `components/` — shell + header + views + modals + form + details. **Onda 5**
- `ai/` — `tools.ts` (LLM) + `context.ts` (page snapshot) + `permissions.ts`. **Onda 6**

## Status Onda 1
Criados:
- `domain/session.ts` — `WorkflowSession` canônico (movido de `useWorkflowRealtime.ts`).
- `domain/payment.ts`, `domain/money.ts`, `domain/pricing.ts`, `domain/filters.ts`, `domain/sort.ts`.
- `store/workflowStore.ts` — indexers `byId`, `bySessionId`, `byMonth`, `lastSeq`.
- `store/selectors.ts` — `selectMonthSessions`, `selectFilteredSorted`, `selectMonthMetrics`, `selectSituacaoCounts`.

Shim: `hooks/useWorkflowRealtime.ts` re-exporta `WorkflowSession` de `@/features/workflow`. Nenhum import existente quebra.

Próximo: **Onda 2 — Data layer**. Revisar `.lovable/plan.md` antes de começar.
