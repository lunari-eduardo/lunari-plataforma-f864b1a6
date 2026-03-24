

# CRITICAL FIX: RLS Bypass on `extrato_unificado` View

## Root Cause

The view `extrato_unificado` is owned by `postgres` and was created **without `security_invoker=on`**. This means:

- The view executes queries as `postgres` (superuser), which **bypasses ALL RLS policies** on every underlying table
- Every authenticated user sees **all users' financial data** — not just their own
- The frontend query in `useExtratoSupabase.ts` does not add a `user_id` filter, trusting RLS to handle isolation

This is a **complete data exposure vulnerability** affecting all users.

## Fix Plan

### 1. Database Migration — Recreate view with `security_invoker=on`

Recreate the view with the `WITH (security_invoker=on)` option. This makes the view execute queries using the **calling user's permissions**, so RLS policies on `clientes_transacoes`, `fin_transactions`, etc. will apply correctly.

```sql
CREATE OR REPLACE VIEW extrato_unificado
WITH (security_invoker=on) AS
-- (same view definition, unchanged)
```

**Why this works**: With `security_invoker=on`, when user `07diehl` queries the view, PostgreSQL evaluates RLS policies on `clientes_transacoes` using `07diehl`'s `auth.uid()`, so they only see their own rows. Same for `fin_transactions`, `cobrancas`, etc.

### 2. Frontend safety net — Add `user_id` filter in query

Even with RLS working, add an explicit `.eq('user_id', userId)` filter in `useExtratoSupabase.ts` as defense-in-depth. This prevents any future RLS misconfiguration from leaking data.

```typescript
// After building the query, before .range():
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');
query = query.eq('user_id', user.id);
```

## Files to Modify

| File | Change |
|------|--------|
| New migration SQL | Recreate `extrato_unificado` with `security_invoker=on` |
| `src/hooks/useExtratoSupabase.ts` | Add explicit `user_id` filter as defense-in-depth |

## Impact

- Immediately stops cross-user data exposure
- No functional change for users — they will only see their own data (as intended)
- No schema changes, no new tables — just the view attribute and a query filter

