

# Fix Admin Panel: RLS, Email Display, and Credits/Storage Management

## Issues

1. **Users tab shows only admin**: `profiles` table has no admin SELECT policy -- confirmed via `pg_policies` query showing only `auth.uid() = user_id` for SELECT
2. **Subscriptions tab shows "N/A" for emails**: Same cause -- `AdminSubscriptionsTab` fetches profiles to resolve emails but RLS blocks it
3. **Admin user has no action buttons**: Code at line 390 has `{!user.is_admin && (...)}` guard
4. **AllowedEmailsManager has no credits/storage management**: Only plan_code can be changed

## Implementation

### Step 1: SQL Migration -- Add admin SELECT on profiles

```sql
CREATE POLICY "Admins can select all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

This single policy fixes issues 1 and 2. The `photographer_accounts` table already has an admin policy (`Admins can manage all accounts` for ALL).

### Step 2: Fix AdminUsuarios -- Show actions for admin user

Remove the `!user.is_admin` guard on line 390 so the admin can manage their own credits/storage too.

### Step 3: Add credits/storage actions to AllowedEmailsManager

Add dropdown menu items:
- "Gerenciar Creditos" -- looks up user_id via email from profiles, opens CreditsModal
- "Ajustar Storage" -- same lookup, opens StorageModal

Import and reuse `CreditsModal` and `StorageModal` from `AdminUserActions.tsx`. These already update `photographer_accounts.photo_credits` and `photographer_accounts.free_transfer_bytes` respectively.

The `admin_grant_credits` RPC (used by CreditsModal) correctly updates `photographer_accounts.photo_credits` and records in `credit_ledger` + `admin_credit_grants`.

## Files to modify

| File | Change |
|------|--------|
| New SQL migration | Add admin SELECT policy on `profiles` |
| `src/pages/AdminUsuarios.tsx` | Remove `!user.is_admin` guard on actions dropdown |
| `src/components/admin/AllowedEmailsManager.tsx` | Add credits/storage menu items using existing modals from AdminUserActions |

