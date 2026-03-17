

# Fix: Net Value Recording + Reorganize Anticipation Settings & Charge Modal

## Problems Identified

1. **No net value stored**: When photographer absorbs fees, the trigger `ensure_transaction_on_cobranca_paid` uses `NEW.valor` (R$100 gross) instead of the net value received (~R$94). The `cobrancas` table has no `valor_liquido` column.

2. **Confusing anticipation settings**: The current toggles ("Absorver taxas" + "Incluir taxa de antecipação") don't reflect reality. If the photographer won't anticipate, there's no anticipation fee at all. The toggle should be: "Irei antecipar parcelas" → if yes, show "Repassar taxa de antecipação ao cliente".

3. **No per-charge override**: The photographer can't choose at charge-time whether to absorb fees or anticipate — it's all global settings.

## Plan

### 1. Database Migration: Add `valor_liquido` to `cobrancas`

```sql
ALTER TABLE cobrancas ADD COLUMN valor_liquido NUMERIC;
```

Update the trigger `ensure_transaction_on_cobranca_paid` to use `COALESCE(NEW.valor_liquido, NEW.valor)` for the transaction value. This way, when fees are absorbed, the financial record reflects what the photographer actually receives.

### 2. Reorganize Settings in `AsaasCard.tsx`

Replace the current two toggles with clearer logic:

- **"Absorver taxas de processamento"** — toggle (you pay processing fees)
- **"Irei antecipar parcelas"** — toggle (whether you plan to request anticipation from Asaas)
  - If ON → show sub-toggle: **"Repassar taxa de antecipação ao cliente"**
  - If OFF → no anticipation fee exists for anyone

Store in `dados_extras`: `absorverTaxa`, `ireiAntecipar` (new), `repassarTaxaAntecipacao` (replaces `incluirTaxaAntecipacao`). Maintain backward compatibility by reading `incluirTaxaAntecipacao` as fallback.

### 3. Add Per-Charge Overrides in `ChargeModal.tsx`

When Asaas is selected and the charge is via Link (checkout), add compact toggles below the valor:
- "Repassar taxas de processamento" (inverse of absorver — pre-filled from settings)
- "Antecipar parcelas" (pre-filled from settings) → if on, "Repassar taxa de antecipação"

These overrides are passed to the edge function and stored on the `cobrancas` record as metadata so the checkout page knows the correct fee behavior.

### 4. Update Edge Functions to Store `valor_liquido`

**`checkout-process-payment/index.ts`** and **`gestao-asaas-create-payment/index.ts`**:
- After creating the Asaas payment, read `paymentData.netValue` from the response
- Store it as `valor_liquido` on the `cobrancas` record
- For installment payments: Asaas returns `netValue` on the initial creation response representing the total net
- When `absorverTaxa = true` and no anticipation: `valorFinal = valor` (no markup), but `valor_liquido = paymentData.netValue`

**`check-payment-status/index.ts`**:
- When fetching payment status from Asaas, also capture `netValue` and update `cobrancas.valor_liquido`

### 5. Update Trigger to Use Net Value

```sql
-- Replace NEW.valor with COALESCE(NEW.valor_liquido, NEW.valor)
-- in the INSERT into clientes_transacoes
```

This ensures:
- Old charges without `valor_liquido` → use `valor` (backward compatible)
- New absorbed-fee charges → use `valor_liquido` (actual received amount)

### 6. Update Checkout Frontend Fee Logic

Both `AsaasCheckoutSection.tsx` and `PublicCheckout.tsx`:
- Read per-charge overrides from the cobrança metadata (via `checkout-get-data`)
- Use overrides instead of global settings when available
- Anticipation fees only calculated when `ireiAntecipar = true`

### 7. Update Frontend Types

- `src/types/cobranca.ts`: Add `valorLiquido?: number`
- `src/hooks/useCobranca.ts`: Map `valor_liquido` field

## Files Changed

| File | Change |
|------|--------|
| DB Migration | Add `valor_liquido` column + update trigger |
| `src/components/integracoes/AsaasCard.tsx` | Reorganize toggles: absorver + ireiAntecipar + repassar |
| `src/components/cobranca/ChargeModal.tsx` | Add per-charge fee override toggles for Asaas |
| `src/components/cobranca/AsaasChargeOptions.tsx` | Accept and display override props |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Store `valor_liquido`, accept per-charge overrides |
| `supabase/functions/checkout-process-payment/index.ts` | Store `valor_liquido` from Asaas response |
| `supabase/functions/checkout-get-data/index.ts` | Pass per-charge overrides to checkout |
| `supabase/functions/check-payment-status/index.ts` | Capture `netValue` on status check |
| `src/components/cobranca/AsaasCheckoutSection.tsx` | Use per-charge overrides for fee calc |
| `src/pages/PublicCheckout.tsx` | Use per-charge overrides for fee calc |
| `src/types/cobranca.ts` | Add `valorLiquido` |
| `src/hooks/useCobranca.ts` | Map `valor_liquido` |

## Settings UX (AsaasCard)

```text
Cartão de Crédito                    [ON]
├── Máximo de parcelas: 6x
├── Absorver taxas de processamento  [ON]
│   "Você paga as taxas de cartão"
├── Irei antecipar parcelas          [OFF]
│   "Você pretende solicitar antecipação no Asaas"
│   └── (se ON) Repassar taxa de antecipação  [ON/OFF]
│       "Inclui taxa de antecipação no valor do cliente"
```

## Charge Modal UX (per-charge)

```text
Valor: R$ 100,00
Descrição: ...
Meio: Asaas ▼

── Opções desta cobrança ──
Repassar taxas de processamento  [OFF]  ← inverted from absorver
Antecipar parcelas               [OFF]
  └── Repassar antecipação       [—]
```

