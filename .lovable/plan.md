

# Fix: Installment Payment Duplication and Missing Parcelas

## Root Cause Analysis

Three distinct issues compound to produce the symptoms:

### Bug 1: `check-payment-status` with `forceUpdate: true` bypasses parcela flow

In `src/hooks/useCobranca.ts` line 327, the photographer's "verificar pagamento" action calls `check-payment-status` with `forceUpdate: true`. This directly sets `cobrancas.status = 'pago'` — completely bypassing the parcela creation and fee tracking flow. For this specific cobrança:
- `parcelas_pagas = 0` (no parcelas were ever created)
- `valor_liquido = null` (no fees tracked)
- `cobranca_parcelas` table is empty for this cobrança
- Asaas webhook never fired (no entries in `asaas_webhook_events`)

The cobrança was set to 'pago' solely by the manual verification.

### Bug 2: `valor_pago` inconsistency (200 vs 100)

Database shows:
- `clientes_transacoes` SUM for this session = R$100 (one auto-reconciled transaction)
- `clientes_sessoes.valor_pago` = R$200

This mismatch means `recompute_session_paid` ran at a moment when another transaction existed (likely a quick payment that was later deleted, or a duplicate that was cleaned up). Either way, the recompute trigger did not fire on the deletion. This is caused by **duplicate triggers** on `clientes_transacoes`:

```text
1. recompute_paid_amount         → AFTER INSERT/UPDATE/DELETE
2. trigger_recompute_session_paid_insert → AFTER INSERT only
```

These should be consolidated. While the duplicate INSERT trigger isn't the direct cause, it indicates migration cleanup issues.

### Bug 3: ChargeHistory display misleading for parcelas

When status is `'pago'`, the UI hardcodes `(totalParcelas/totalParcelas)` regardless of actual `parcelas_pagas`. Shows "(2/2)" even when `parcelas_pagas = 0`.

## Fix Plan

### 1. Fix `check-payment-status` — Query Asaas API instead of force-updating

The Edge Function should query the Asaas API (`GET /v3/payments/{id}`) to check actual payment status before updating the cobrança. If installments exist, it should also create `cobranca_parcelas` records with fee data from the API response. Remove the blind `forceUpdate` path.

**File:** `supabase/functions/check-payment-status/index.ts`

Changes:
- When `forceUpdate=true` AND cobrança has `asaas_installment_id` or `mp_payment_id`:
  - Fetch payment from Asaas API: `GET /v3/payments?installment={installmentId}`
  - Create/update `cobranca_parcelas` for each payment found
  - Let the `reconcile_cobranca_from_parcelas` trigger handle status transition naturally
- Only use the direct `status='pago'` fallback for non-Asaas providers (manual, etc.)

### 2. Fix `useCobranca.ts` — Remove `forceUpdate: true` default

**File:** `src/hooks/useCobranca.ts`

Change `forceUpdate: true` to `forceUpdate: false` for the standard check. The photographer's action should just poll status, not force it. The Edge Function above handles the Asaas API query when needed.

### 3. Database migration — Clean up triggers + data repair

**New migration:**

```sql
-- 1. Remove duplicate trigger
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_insert ON public.clientes_transacoes;

-- 2. Data repair: recompute valor_pago for the affected session
SELECT public.recompute_session_paid('workflow-1774277716258-xcgajp03wr');
```

### 4. Fix ChargeHistory display

**File:** `src/components/cobranca/ChargeHistory.tsx`

Use actual `parcelas_pagas` instead of hardcoding `totalParcelas` when status is `'pago'`:

```tsx
// Before
? ` (${cobranca.totalParcelas}/${cobranca.totalParcelas})`
// After  
? ` (${cobranca.parcelasPagas || cobranca.totalParcelas}/${cobranca.totalParcelas})`
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/check-payment-status/index.ts` | Query Asaas API for installment payments instead of blind force-update |
| `src/hooks/useCobranca.ts` | Change `forceUpdate: true` to `false` |
| `src/components/cobranca/ChargeHistory.tsx` | Use actual `parcelas_pagas` in display |
| New migration SQL | Remove duplicate trigger, repair valor_pago |

