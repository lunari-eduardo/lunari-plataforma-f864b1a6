

# Fix: Make Anticipation Toggle Independent from "Absorver Taxas"

## Problem

When `absorverTaxa` is enabled, the `incluirTaxaAntecipação` toggle is hidden in the UI (wrapped in `{!absorverTaxa && ...}`). This prevents the photographer from choosing to pass anticipation costs to the client while still absorbing processing fees. Additionally, all fee calculation in both edge functions and frontend is skipped entirely when `absorverTaxa = true`, so no fees are ever added to the client price — even anticipation.

## Correct Behavior

The two toggles should be independent:

| absorverTaxa | incluirTaxaAntecipacao | Client pays |
|---|---|---|
| false | false | valor + processing fees |
| false | true | valor + processing + anticipation |
| **true** | **false** | valor (photographer absorbs all) |
| **true** | **true** | valor + anticipation only |

## Changes (5 files)

### 1. `src/components/integracoes/AsaasCard.tsx`
Remove the `{!absorverTaxa && ...}` conditional around the anticipation toggle in both the initial setup form (line 247) and edit form (line 335). The toggle should always be visible. Update the description text contextually: when `absorverTaxa` is true, show "Repassa taxa de antecipação ao cliente".

### 2. `supabase/functions/gestao-asaas-create-payment/index.ts`
Refactor the fee calculation block (line 210). Instead of `if (!settings.absorverTaxa)` gating everything:
- Fetch Asaas fees whenever `billingType === 'CREDIT_CARD'` AND either `!absorverTaxa` OR `incluirTaxaAntecipacao`
- Add processing cost to `valorFinal` only if `!absorverTaxa`
- Add anticipation cost to `valorFinal` only if `incluirTaxaAntecipacao`

### 3. `supabase/functions/checkout-process-payment/index.ts`
Same refactor as above — identical logic change at line 155.

### 4. `src/components/cobranca/AsaasCheckoutSection.tsx`
- Line 151: Fetch fees even when `absorverTaxa` is true (if `incluirTaxaAntecipacao` is enabled)
- Lines 262-284: Split fee calculation — only add processing fees if `!absorverTaxa`, only add anticipation if `incluirTaxaAntecipacao`

### 5. `src/pages/PublicCheckout.tsx`
- Lines 274-296: Same split — only add processing if `!absorverTaxa`, only add anticipation if `incluirTaxaAntecipacao`

## Technical Detail

The fee fetch condition changes from:
```text
if (absorverTaxa) return;  // skip everything
```
to:
```text
if (absorverTaxa && !incluirTaxaAntecipacao) return;  // only skip if nothing to calculate
```

The fee application changes from:
```text
valorFinal = valor + processingCost + anticipationCost
```
to:
```text
valorFinal = valor
  + (!absorverTaxa ? processingCost : 0)
  + (incluirAntecipacao ? anticipationCost : 0)
```

