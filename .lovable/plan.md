

# Fix: Gallery Asaas Payments Not Creating Transactions or Recording Fees

## Root Cause Analysis

Three cascading bugs prevent Gallery Asaas payments from appearing in the extrato:

### Bug 1: `asaas-gallery-payment` sets `status = 'pago'` on INSERT (credit card)
When a credit card payment confirms immediately, the Edge Function inserts the cobrança with `status: 'pago'`. The `ensure_transaction_on_cobranca_paid` trigger is an **AFTER UPDATE** trigger — it only fires when status **changes** from non-pago to pago. An INSERT with status already `'pago'` never triggers it.

Then `finalize_gallery_payment` RPC finds `status = 'pago'`, returns early as "already_paid", and nothing creates the transaction.

### Bug 2: `asaas-gallery-webhook` doesn't extract `netValue`
The webhook receives the Asaas payment object (which includes `payment.netValue`) but never reads it. It calls `finalize_gallery_payment` without setting `valor_liquido` on the cobrança, so even when the trigger fires, `taxa_gateway` is always 0.

### Bug 3: `asaas-gallery-webhook` doesn't create parcelas
Unlike the main `asaas-webhook` (which calls `upsertParcela`), the gallery webhook skips parcela creation entirely. This means no granular fee tracking exists for gallery payments.

### Bug 4: Standalone galleries (`session_id = NULL`) silently skipped
The `ensure_transaction_on_cobranca_paid` trigger does `IF NEW.session_id IS NULL THEN RETURN NEW` — standalone gallery payments are permanently orphaned.

## Fix Plan

### 1. Fix `asaas-gallery-payment/index.ts` — Always insert as `'pendente'`

Per the existing architectural rule (memory: `payment-initialization-status-constraint`), ALL payment initializations must start as `'pendente'`. Remove the `isConfirmed` shortcut:

```typescript
// Line 427: ALWAYS pendente — let webhook handle transition
status: 'pendente',
data_pagamento: null,
```

Remove the `isConfirmed` block (lines 456-470) that calls `finalize_gallery_payment` directly. The webhook will handle everything.

### 2. Fix `asaas-gallery-webhook/index.ts` — Extract fees and create parcela

Before calling `finalize_gallery_payment`, the webhook must:
- Extract `payment.netValue` from the Asaas payload
- Update `cobrancas.valor_liquido` with it
- Create a `cobranca_parcelas` record (like `upsertParcela` does in the main webhook)

```typescript
// Extract net value from Asaas payment
const valorBruto = payment.value || cobranca.valor;
const valorLiquido = payment.netValue ?? null;
const taxaGateway = valorLiquido != null 
  ? Math.round((valorBruto - valorLiquido) * 100) / 100 
  : 0;

// Update cobranca with valor_liquido BEFORE finalize
await supabase.from('cobrancas').update({
  valor_liquido: valorLiquido,
}).eq('id', cobranca.id);

// Create parcela for fee tracking
await supabase.from('cobranca_parcelas').upsert({
  cobranca_id: cobranca.id,
  numero_parcela: payment.installmentNumber || 1,
  asaas_payment_id: payment.id,
  valor_bruto: valorBruto,
  valor_liquido: valorLiquido,
  taxa_gateway: taxaGateway,
  status: 'confirmado',
  billing_type: payment.billingType || null,
  data_pagamento: payment.paymentDate || new Date().toISOString(),
}, { onConflict: 'asaas_payment_id' });

// Then call finalize_gallery_payment as before
```

The `reconcile_cobranca_from_parcelas` trigger will then update `cobrancas.valor_liquido` and set `status = 'pago'`, which fires `ensure_transaction_on_cobranca_paid` → creates the transaction with correct `taxa_gateway`.

### 3. Fix `finalize_gallery_payment` RPC — Handle `valor_liquido` propagation

The RPC currently does `UPDATE cobrancas SET status = v_final_status` but doesn't preserve `valor_liquido`. Since the reconcile trigger now handles status via parcelas, the RPC should NOT override status if parcelas exist. Add a check:

```sql
-- Only update status directly if no parcelas exist (manual/legacy flow)
-- If parcelas exist, reconcile trigger handles status
```

### 4. Data repair — Fix the 2 stuck cobranças

```sql
-- Cobrança with session_id (trigger will fire)
UPDATE cobrancas SET 
  status = 'pendente', 
  updated_at = now() 
WHERE id = '1102ed52-93bc-498e-aacd-2269ccda296c';

UPDATE cobrancas SET 
  status = 'pago', 
  data_pagamento = '2026-03-23T04:53:06.895Z',
  updated_at = now() 
WHERE id = '1102ed52-93bc-498e-aacd-2269ccda296c';

-- Standalone cobrança (no session_id) — needs manual transaction
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/asaas-gallery-payment/index.ts` (Gallery) | Always insert `status: 'pendente'`, remove immediate finalization |
| `supabase/functions/asaas-gallery-webhook/index.ts` (Gallery) | Extract `netValue`, create parcela, update `valor_liquido` before finalize |
| New migration SQL | Data repair for stuck cobranças |

## Documentation for Gallery Project

A documentation file will be generated at `/mnt/documents/gallery-payment-integration-rules.md` containing:

1. **Immutable Rules** — All payments must start as `'pendente'`; only webhooks transition to `'pago'`
2. **Fee Recording Contract** — Webhooks must extract `netValue`, create `cobranca_parcelas`, set `valor_liquido`
3. **Trigger Chain** — `cobranca_parcelas` → `reconcile_cobranca_from_parcelas` → `cobrancas.valor_liquido` + `status` → `ensure_transaction_on_cobranca_paid` → `clientes_transacoes` → `recompute_session_paid`
4. **Shared Infrastructure Map** — Which tables, triggers, and functions are shared between projects

