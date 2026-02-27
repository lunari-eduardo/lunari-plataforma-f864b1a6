

# Fix: Checkout UX Issues (3 items)

## Issue 1: Remove address fields from checkout

**File**: `src/pages/EscolherPlanoPagamento.tsx`

Remove the CEP and "Nº endereço" fields (lines 462-471), remove `postalCode` and `addressNumber` state variables, remove CEP validation from `validatePersonalData`, and hardcode `postalCode: "00000000"` and `addressNumber: "S/N"` in the `holderPayload` (lines 222-223) since Asaas requires these fields but we don't need to collect them from the user.

Also remove from `CardData` interface (lines 286-287).

## Issue 2: Autofilled inputs appear gray

**File**: `src/components/ui/input.tsx`

Add CSS to override browser autofill styling. Add these classes to the input:
```
autofill:bg-lunar-surface autofill:text-lunar-text
[-webkit-autofill]:bg-lunar-surface [-webkit-autofill]:text-lunar-text
```
And add a `<style>` or use Tailwind's `autofill:` variant with `shadow-[inset_0_0_0px_1000px]` trick to force background color on autofill.

## Issue 3: After upgrade, hide cancelled old subscription

**File**: `src/hooks/useAsaasSubscription.ts`

In the query function, after fetching active subscriptions, modify the fallback logic for CANCELLED subs (around line 125-131). Currently it adds cancelled subs if no active sub has the same `plan_type`. After an upgrade, the old plan has a different plan_type so it passes the filter.

Fix: If any ACTIVE subscription exists, skip the cancelled fallback entirely. The cancelled sub from a replaced plan should not show. Only show cancelled subs when there are zero active/pending/overdue subscriptions (meaning user explicitly cancelled, not upgraded).

```typescript
// Only show cancelled subs if user has NO active subscriptions at all
if (results.length === 0 && cancelledSubs) {
  results.push(...(cancelledSubs as unknown as AsaasSubscription[]));
}
```

This way: upgrade → old sub cancelled → new sub ACTIVE → only new sub shows. Manual cancel → no active subs → cancelled sub shows with "active until" notice.

## Files to modify

| File | Change |
|------|--------|
| `src/pages/EscolherPlanoPagamento.tsx` | Remove CEP/address fields, hardcode in payload |
| `src/components/ui/input.tsx` | Fix autofill styling |
| `src/hooks/useAsaasSubscription.ts` | Only show cancelled subs when no active subs exist |

