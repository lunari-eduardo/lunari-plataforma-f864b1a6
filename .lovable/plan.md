

# Fix: Asaas rejects hardcoded CEP "00000000"

## Root Cause

The edge function logs show: `code: "invalid_creditCard", description: "O CEP informado é inválido."`. The checkout form hardcodes `postalCode: "00000000"` (line 223 of `EscolherPlanoPagamento.tsx`) per a previous simplification. Asaas sandbox now validates this field and rejects it.

## Fix

Add a CEP field back to the checkout form. It's a single field — minimal UI impact.

### `src/pages/EscolherPlanoPagamento.tsx`

1. Add `postalCode` state in `CardCheckoutForm`
2. Add CEP input field in the "personal" step (after phone)
3. Validate CEP has 8 digits in `validatePersonalData`
4. Pass `postalCode` in `CardData` interface and through to `holderPayload`
5. Replace hardcoded `"00000000"` with actual user input

### Files to modify

| File | Change |
|------|--------|
| `src/pages/EscolherPlanoPagamento.tsx` | Add CEP field to form, pass real value to API |

