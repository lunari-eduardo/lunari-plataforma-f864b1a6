
# Fix: Prorata Credit Calculation with Corrupted `next_due_date` Data

## Root Cause Analysis

The subscription `aca0b764` (Transfer 5GB for fotografandocarros@gmail.com) has:
- `created_at: 2026-03-02 19:15`
- `next_due_date: 2026-03-03` (1 day later — should be `2026-04-01`)

This causes `daysRemaining = 0` (less than 24h to next_due_date), so credit = R$0.00. The Combo Completo shows full price R$64.90 with no discount.

The corruption comes from the **webhook** `PAYMENT_CONFIRMED` handler (line 228-234 in asaas-webhook): it overwrites `next_due_date` with `payment.dueDate + cycleDays`. If Asaas fires a duplicate or unexpected event, or `payment.dueDate` is malformed, the value gets corrupted. Additionally, the webhook log insert uses column name `provider` but the table column is `provedor`, so webhook events fail to log silently — making debugging impossible.

## Three fixes needed

### 1. Prorata calculation: use standard cycle length with safety guards

**Files: `src/pages/EscolherPlano.tsx`, `supabase/functions/asaas-upgrade-subscription/index.ts`**

Revert `totalCycleDays` to use standard 30/365 (instead of `created_at→next_due_date` which is unreliable). Keep the credit cap at plan price. Also cap `daysRemaining` at `cycleDays` to prevent ratio > 1:

```ts
const cycleDays = billingCycle === "YEARLY" ? 365 : 30;
const daysRemaining = Math.min(
  Math.max(0, differenceInDays(new Date(nextDueDate), new Date())),
  cycleDays
);
const credit = Math.min(
  Math.round(priceCents * (daysRemaining / cycleDays)),
  priceCents
);
```

This handles all edge cases:
- Normal case (25 days remaining / 30 cycle): correct proportional credit
- Corrupted next_due_date too close (0 days remaining): credit = 0 (acceptable — user gets charged full but backend also calculates same)
- Corrupted next_due_date too far (62 days remaining): capped at 30, credit = full price, then capped at priceCents

Apply in all 4 prorata calculation sites: `getCrossProductProrata`, top-level `totalCycleDays`/`daysRemaining`, and the edge function.

### 2. Webhook: fix `next_due_date` calculation and logging

**File: `supabase/functions/asaas-webhook/index.ts`**

- Fix `PAYMENT_CONFIRMED` handler: always calculate `next_due_date = today + cycleDays` (not `paymentDate + cycleDays`) to avoid Asaas sandbox quirks. The payment date from Asaas can be unreliable.
- Fix webhook log column: `provider` → `provedor`
- Add guard: if calculated `next_due_date` would be less than 7 days from now for a monthly plan, use `today + 30` as fallback.

### 3. Checkout label fix

**File: `src/pages/EscolherPlanoPagamento.tsx`**

- Change "Diferença proporcional" → "Crédito de planos ativos" (line 114)

### 4. Fix existing bad data (SQL migration)

Update the corrupted subscription:
```sql
UPDATE subscriptions_asaas 
SET next_due_date = (created_at::date + interval '30 days')::date
WHERE id = 'aca0b764-d9ba-4fe2-bae4-24615d1a4abb';
```

Also fix any other subscriptions where `next_due_date - created_at < 7 days` for monthly plans.

## Files to modify

| File | Change |
|------|--------|
| `src/pages/EscolherPlano.tsx` | Revert to standard 30/365 cycle; cap daysRemaining at cycleDays |
| `supabase/functions/asaas-upgrade-subscription/index.ts` | Same: standard cycle + cap |
| `supabase/functions/asaas-webhook/index.ts` | Fix next_due_date calc (use today + cycle); fix log column `provider→provedor` |
| `src/pages/EscolherPlanoPagamento.tsx` | Label "Diferença proporcional" → "Crédito de planos ativos" |
| SQL migration | Fix corrupted next_due_date data |
