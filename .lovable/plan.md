

# Fix: New users blocked from onboarding by "Acesso Restrito"

## Root Cause

In `ProtectedRoute.tsx`, the subscription check (step 6, line 83) runs BEFORE the onboarding check (step 7, line 117). For new users:

1. User signs up, confirms email, logs in
2. `get_access_state()` returns `no_subscription` (no trial, no sub, no allowed_email)
3. ProtectedRoute shows "Acesso Restrito" wall at step 6
4. User never reaches step 7 (onboarding redirect)
5. Trial never starts because it's triggered at end of onboarding
6. **Deadlock**: can't get trial without onboarding, can't reach onboarding without trial

The 409 Conflict errors are from `InitialDataService` trying to seed default data (categorias, pacotes, etc.) — a secondary issue from ConfigurationService initializing during this blocked state.

## Fix

### 1. Reorder ProtectedRoute logic

Move the onboarding check (step 7) BEFORE the subscription check (step 6). When user has `no_subscription` but hasn't completed onboarding → redirect to `/onboarding` instead of showing "Acesso Restrito".

**File**: `src/components/auth/ProtectedRoute.tsx`

Change the order so that after checking trial_expired (step 5), we check:
- If `no_subscription` AND user needs onboarding → redirect to `/onboarding`
- If `no_subscription` AND onboarding complete → show "Acesso Restrito"

This way new users flow through onboarding → trial starts → access granted.

### 2. No SQL changes needed

The `start_studio_trial()` RPC and `get_access_state()` are already correct. The issue is purely in the frontend routing logic.

## Files to modify

| File | Change |
|------|--------|
| `src/components/auth/ProtectedRoute.tsx` | Move onboarding check before subscription wall; redirect new users to `/onboarding` when `no_subscription` and onboarding incomplete |

