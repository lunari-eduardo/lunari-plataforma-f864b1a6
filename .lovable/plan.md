

# Fix: Studio Trial Blocked by Gallery-Only Subscription

## Root Cause Analysis

There are **two bugs** in the Supabase RPCs and **one UI gap**:

### Bug 1: `start_studio_trial` blocks trial for Gallery subscribers

In the RPC (lines 37-44), it checks for ANY active subscription:
```sql
SELECT EXISTS(
  SELECT 1 FROM public.subscriptions_asaas
  WHERE user_id = v_user_id AND status IN ('ACTIVE', 'PENDING')
) INTO v_has_subscription;

IF v_has_subscription THEN
  RETURN 'Already has subscription';  -- BLOCKS TRIAL
END IF;
```

The user has Transfer 5GB (a Gallery-only plan with `includes_studio = false`), so the trial is incorrectly blocked. **Fix:** only block if the subscription includes Studio access.

### Bug 2: `get_access_state` returns Gallery subscription and never checks trial

Step 4 (lines 157-194) finds the Transfer 5GB subscription and returns immediately with `status: 'ok'` and `planCode: 'transfer_5gb'`. It never reaches Step 5 (trial check). So even if the trial existed, it would be invisible.

**Fix:** If the found subscription does NOT include Studio (`includes_studio = false`), don't return yet -- continue to Step 5 to check the trial. If both exist, merge them: return `status: 'ok'` with the subscription info PLUS `isTrial: true` and `planCode` reflecting Studio trial access.

### UI Gap: MinhaAssinatura doesn't show trial status

The page only renders Asaas subscription cards. When a user is on trial (with or without a Gallery subscription), there's no visual indication of the trial period.

## Plan

### 1. SQL Migration: Fix both RPCs

**`start_studio_trial`:**
- Change the subscription check to only look for subscriptions where the plan includes Studio:
```sql
SELECT EXISTS(
  SELECT 1 FROM public.subscriptions_asaas sa
  LEFT JOIN public.unified_plans up ON up.code = sa.plan_type
  WHERE sa.user_id = v_user_id 
    AND sa.status IN ('ACTIVE', 'PENDING')
    AND (COALESCE(up.includes_studio, false) = true 
         OR sa.plan_type LIKE 'studio_%' 
         OR sa.plan_type LIKE 'combo_%')
) INTO v_has_subscription;
```

**`get_access_state`:**
- After Step 4 finds a subscription, check if it includes Studio. If NOT, store the subscription data but continue to Step 5 (trial check).
- If trial is active, return a merged response: Gallery subscription details + `isTrial: true` + `planCode` reflecting the Studio trial.
- If no trial, return the Gallery-only subscription as-is (user has Gallery access but no Studio access, `status: 'ok'` with non-Studio planCode).

### 2. Frontend: Show trial card on MinhaAssinatura

**File: `src/pages/MinhaAssinatura.tsx`**
- When `accessState.isTrial` is true, render a "Período de Teste" card showing:
  - "Teste Grátis - Lunari Studio" title
  - Days remaining (`accessState.daysRemaining`)
  - Trial end date (`accessState.trialEndsAt`)
  - Badge "Teste Grátis"
  - CTA button to choose a plan
- This card appears alongside any existing Gallery subscription cards.

## Files to Modify

| File | Change |
|------|--------|
| SQL Migration | Fix `start_studio_trial` to only block on Studio-family subs; fix `get_access_state` to not short-circuit on Gallery-only subs |
| `src/pages/MinhaAssinatura.tsx` | Add trial status card when `accessState.isTrial` |

