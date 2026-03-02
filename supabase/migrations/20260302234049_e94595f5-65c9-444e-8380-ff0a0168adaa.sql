-- Fix specific corrupted subscription
UPDATE subscriptions_asaas 
SET next_due_date = (created_at::date + interval '30 days')::date
WHERE id = 'aca0b764-d9ba-4fe2-bae4-24615d1a4abb';

-- Fix any other monthly subscriptions where next_due_date is less than 7 days after created_at
UPDATE subscriptions_asaas 
SET next_due_date = (created_at::date + interval '30 days')::date
WHERE billing_cycle = 'MONTHLY'
  AND status IN ('ACTIVE', 'PENDING')
  AND next_due_date IS NOT NULL
  AND (next_due_date::date - created_at::date) < 7;