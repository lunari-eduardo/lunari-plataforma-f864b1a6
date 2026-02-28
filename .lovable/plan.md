

# Problem: Edge functions were edited but never deployed

The code fixes for `next_due_date` are correct in the source files, but the Supabase Edge Functions were **never deployed to production**. The old code is still running, storing wrong dates.

**Proof from DB:**
- `studio_starter` created `2026-02-28` → `next_due_date: 2026-03-02` (should be `2026-03-30`)
- `transfer_5gb` created `2026-02-28` → `next_due_date: 2026-03-02` (should be `2026-03-30`)

## Steps

### 1. Deploy all 3 edge functions
- `asaas-create-subscription` — stores correct period end
- `asaas-upgrade-subscription` — calculates fresh period end for new sub
- `asaas-webhook` — advances `next_due_date` correctly on payment/renewal

### 2. Fix existing broken records in DB
Run a corrective query to set `next_due_date = created_at + 30 days` (monthly) or `+ 1 year` (yearly) for all active subscriptions that currently have wrong dates:

```sql
UPDATE subscriptions_asaas
SET next_due_date = 
  CASE 
    WHEN billing_cycle = 'YEARLY' THEN (created_at + interval '1 year')::date
    ELSE (created_at + interval '30 days')::date
  END
WHERE status IN ('ACTIVE', 'PENDING')
  AND next_due_date < (created_at + interval '5 days')::date;
```

This targets only records where `next_due_date` is suspiciously close to `created_at` (within 5 days — the telltale sign of the old `getNextBusinessDay()` bug).

### No code changes needed
The source code is already correct. This is purely a deployment + data fix.

