

# Fix: Shared Edge Function Missing Studio Plans (400 Error)

## Root Cause

The `asaas-create-subscription` edge function is **shared between Gestão and Gallery** on the same Supabase instance. The Gallery version's `PLANS` map is missing `studio_starter` and `studio_pro`:

**Gallery version (currently deployed):**
```
transfer_5gb, transfer_20gb, transfer_50gb, transfer_100gb, combo_pro_select2k, combo_completo
```

**Gestão version (correct/unified):**
```
studio_starter, studio_pro, transfer_5gb, transfer_20gb, transfer_50gb, transfer_100gb, combo_pro_select2k, combo_completo
```

When Gallery was last deployed, it overwrote the function, removing Studio plans. Studio then sends `planType: "studio_pro"` → function returns `"Invalid plan type"` → 400.

## Fix

Both projects must have **identical** `PLANS` maps in all shared edge functions. The fix is:

1. **This project (Gestão)**: Already has the unified PLANS map — no changes needed, just redeploy to restore the correct version.
2. **Gallery project**: Update its `asaas-create-subscription/index.ts` to include `studio_starter` and `studio_pro` in the PLANS map, so future Gallery deploys won't break Studio again.

### Changes needed in Gallery (`asaas-create-subscription/index.ts`)

Add the two missing entries to the `PLANS` constant:

```typescript
const PLANS = {
  studio_starter: { monthlyPrice: 1490, yearlyPrice: 15198, name: "Lunari Starter" },
  studio_pro: { monthlyPrice: 3590, yearlyPrice: 36618, name: "Lunari Pro" },
  // ... existing transfer + combo plans
};
```

### Changes needed in this project (Gestão)

**None** — the file already has the unified map. Deploying this project will restore the correct function. However, the next Gallery deploy would break it again unless Gallery is also fixed.

### Other shared edge functions to verify

The same pattern likely exists in `asaas-upgrade-subscription`, `asaas-create-payment`, and `asaas-downgrade-subscription`. All must have unified PLANS maps in both projects to prevent future cross-deploy breakage.

## Implementation

1. **Redeploy `asaas-create-subscription` from this project** (touch the file to trigger deploy) — this immediately fixes the 400 error
2. **Update Gallery's copy** of all shared edge functions to include the unified PLANS map (prevents future breakage)

