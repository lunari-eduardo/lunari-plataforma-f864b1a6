

# Unify Edge Functions + UI Fixes for Cross-Project Compatibility

## Problem

Both Gestão and Gallery deploy to the **same Supabase instance**. Whichever project deploys last overwrites the shared edge functions. The Gestão versions are outdated — missing transfer plans, credit handling, storage over-limit logic, auto-healing, and webhook logging. The Gallery versions are the source of truth per the technical handoff document.

## Comparison: What Gestão is Missing

| Edge Function | Missing in Gestão |
|---|---|
| `asaas-create-subscription` | transfer_* plans, `PLAN_SUBSCRIPTION_CREDITS`, `renew_subscription_credits()` call for combos |
| `asaas-upgrade-subscription` | transfer_* plans, over-limit cleanup, gallery reactivation, `STORAGE_LIMITS` |
| `asaas-create-payment` | transfer_* plans, `select` productType, auto-healing for invalid customer, `requestId` |
| `asaas-webhook` | credit expiry/renewal (`expire_subscription_credits`, `renew_subscription_credits`), storage over-limit mode, webhook logging |
| `asaas-downgrade-subscription` | transfer_* plans in `PLAN_ORDER`, storage over-limit check |

## Plan

### Step 1: Update `asaas-create-subscription/index.ts`

Sync with Gallery version. Key additions:
- Add all transfer plans to `PLANS` map
- Add `PLAN_SUBSCRIPTION_CREDITS` map (`combo_pro_select2k: 2000`, `combo_completo: 2000`)
- After inserting subscription, call `renew_subscription_credits` RPC if plan includes credits

### Step 2: Update `asaas-upgrade-subscription/index.ts`

Sync with Gallery version. Key additions:
- Add all transfer plans to `PLANS` map
- After upgrade: clear `account_over_limit`, `over_limit_since`, `deletion_scheduled_at` flags
- Reactivate galleries with status `expired_due_to_plan` if new plan has storage

### Step 3: Update `asaas-create-payment/index.ts`

Sync with Gallery version. Key additions:
- Add all transfer plans to `PLANS` map
- Support `productType = "select"` (credit purchases via Asaas card)
- Auto-healing: if Asaas returns customer error, clear `asaas_customer_id`, recreate, retry 1x
- Add `requestId` to all responses for tracing

### Step 4: Update `asaas-webhook/index.ts`

Sync with Gallery version. Key additions:
- Add `PLAN_SUBSCRIPTION_CREDITS` and `PLAN_PRICES` maps (all plans)
- `SUBSCRIPTION_DELETED/INACTIVATED`: call `expire_subscription_credits` if plan had credits
- `SUBSCRIPTION_RENEWED`: call `renew_subscription_credits` if plan has credits
- `applyDowngrade`: add storage over-limit check (set `account_over_limit`, expire galleries)
- Add webhook logging to `webhook_logs` table

### Step 5: Update `asaas-downgrade-subscription/index.ts`

Add transfer plans to `PLAN_ORDER` so cross-product downgrades work:
```
const PLAN_ORDER = [
  "studio_starter", "transfer_5gb", "transfer_20gb",
  "studio_pro", "transfer_50gb",
  "combo_pro_select2k", "transfer_100gb",
  "combo_completo",
];
```

### Step 6: Update `src/lib/planConfig.ts`

Add transfer plan display names and prices:
```typescript
transfer_5gb: 'Transfer 5GB',
transfer_20gb: 'Transfer 20GB',
transfer_50gb: 'Transfer 50GB',
transfer_100gb: 'Transfer 100GB',
```

### Step 7: Update `src/pages/EscolherPlano.tsx`

- Remove the `<Badge>Gestão</Badge>` (line 186-188)
- Filter `activeSub` in upgrade banner to only show studio/combo plans (not transfer-only)
- If user has a non-studio subscription (e.g., `transfer_5gb`), show subtle inline note with plan icon and marketing name instead of full upgrade banner

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/asaas-create-subscription/index.ts` | Add all plans + credit granting |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Add all plans + over-limit cleanup + gallery reactivation |
| `supabase/functions/asaas-create-payment/index.ts` | Add all plans + select support + auto-healing |
| `supabase/functions/asaas-webhook/index.ts` | Add credit lifecycle + storage over-limit + logging |
| `supabase/functions/asaas-downgrade-subscription/index.ts` | Add transfer plans to PLAN_ORDER |
| `src/lib/planConfig.ts` | Add transfer plan names + prices |
| `src/pages/EscolherPlano.tsx` | Remove badge, filter upgrade banner |

