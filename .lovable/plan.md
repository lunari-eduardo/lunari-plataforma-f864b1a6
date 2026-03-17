

# Fix: Net Value (valor_liquido) + Webhook for Non-Subscription Payments + Per-Charge Overrides Storage

## Problems Found

### 1. `valor_liquido` never gets set when fees are absorbed
In `checkout-process-payment` (line 280):
```js
const valorLiquido = paymentData.netValue ?? (valorFinal !== valor ? valor : null);
```
When `absorverTaxa=true`, `valorFinal === valor` (no markup applied), so the fallback `(valorFinal !== valor ? valor : null)` returns **null**. Asaas typically does NOT return `netValue` on payment creation for credit card — it only becomes available after confirmation/settlement. So `valor_liquido` stays null, and the trigger uses `COALESCE(null, valor)` = full gross amount.

Same issue in `gestao-asaas-create-payment` (line 363).

### 2. Webhook ignores non-subscription payment confirmations
The `asaas-webhook` (line 213-241) only processes `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` for **subscription payments** (`if (payment?.subscription)`). Non-subscription payments from Gestão charges are completely ignored — no status update, no `valor_liquido` capture from the webhook's `payment.netValue`.

### 3. Per-charge overrides are computed but never stored
In `ChargeModal.tsx` (line 262-266), `chargeOverrides` is built but the `insert` on line 269-281 **does not include it**. The checkout page (`checkout-get-data`) reads global settings only, ignoring any per-charge intent.

### 4. No real Asaas Anticipation API integration
Currently anticipation is calculated locally with estimated fees. The user wants to use the real Asaas API: `GET /v3/anticipations/simulate` and `POST /v3/anticipations`.

---

## Solution

### Step 1: Add `dados_extras` to cobrancas for per-charge metadata
Store per-charge overrides in `cobrancas.dados_extras` (JSONB, already exists or add). This lets `checkout-get-data` and `checkout-process-payment` read the correct fee behavior per charge.

**Migration**: Add `dados_extras JSONB` column to `cobrancas` if not present.

### Step 2: Store overrides in ChargeModal
Update `handleAsaasGenerateLink` to include `dados_extras` with the override toggles when inserting the cobrança.

### Step 3: Read per-charge overrides in checkout-get-data
When returning settings to the checkout page, check if `cobranca.dados_extras` has overrides and use them instead of global settings.

### Step 4: Fix webhook to handle non-subscription payments
Add a new block in `asaas-webhook` for `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` when `!payment.subscription`:
- Find the cobrança by `mp_payment_id = payment.id`
- Update `status = 'pago'`, `data_pagamento`, and `valor_liquido = payment.netValue`
- The DB trigger handles transaction creation automatically

### Step 5: Fix valor_liquido fallback in edge functions
In both `checkout-process-payment` and `gestao-asaas-create-payment`:
- For credit card with `absorverTaxa=true`: Don't rely on `paymentData.netValue` at creation time. Instead, set `valor_liquido = null` and let the webhook update it when Asaas confirms.
- For PIX (instant): `paymentData.netValue` is usually available immediately, so capture it.

### Step 6: Create `gestao-asaas-anticipation` edge function
New edge function with two actions:
- **simulate**: `GET /v3/anticipations/simulate` with payment ID → returns anticipated net value, fees, and estimated credit date
- **request**: `POST /v3/anticipations` to actually request anticipation for a specific payment

### Step 7: Frontend anticipation UI in ChargeHistory
Add a "Simular Antecipação" button on confirmed credit card charges (status `pago` but not yet settled). Shows simulation result with original value, anticipation fee, and net value. "Confirmar Antecipação" button to execute.

---

## Files Changed

| File | Change |
|------|--------|
| DB Migration | Add `dados_extras JSONB` to `cobrancas` if missing |
| `src/components/cobranca/ChargeModal.tsx` | Store overrides in `dados_extras` on insert |
| `supabase/functions/checkout-get-data/index.ts` | Read `cobranca.dados_extras` overrides, use over global |
| `supabase/functions/checkout-process-payment/index.ts` | Read overrides from cobrança, fix `valor_liquido` logic |
| `supabase/functions/asaas-webhook/index.ts` | Handle non-subscription `PAYMENT_CONFIRMED/RECEIVED`: update cobrança status + `valor_liquido` |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Fix `valor_liquido` fallback, pass overrides |
| `supabase/functions/gestao-asaas-anticipation/index.ts` | **New**: simulate + request anticipation via Asaas API |
| `supabase/config.toml` | Register new edge function |
| `src/components/cobranca/ChargeHistory.tsx` | Add anticipation simulation/request UI for eligible charges |

## Key Flow After Fix

```text
1. Photographer creates charge (absorverTaxa=true)
   → cobrancas.valor = 100, dados_extras = {overrides...}
   → valor_liquido = NULL (unknown until Asaas confirms)

2. Client pays via checkout
   → checkout-process-payment creates Asaas payment for R$100
   → Asaas returns paymentId, status=PENDING
   → cobrancas.status stays 'pendente'

3. Asaas confirms payment → webhook fires
   → PAYMENT_CONFIRMED with payment.netValue = 94.56
   → Webhook updates cobrancas: status='pago', valor_liquido=94.56
   → DB trigger creates transaction for R$94.56 (net)

4. Photographer sees R$94.56 in financial history ✓
```

