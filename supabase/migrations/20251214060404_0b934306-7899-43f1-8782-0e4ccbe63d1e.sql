-- Corrigir subscription do applunari para refletir estado real do Stripe
UPDATE public.subscriptions 
SET 
  status = 'active',
  stripe_subscription_id = 'sub_1Se5IT2XeR5ffZtltvXIZZ2Y',
  stripe_customer_id = 'cus_TbHssEy9rBAfH1',
  plan_id = '114d1c8e-cafe-4630-9475-41586a7b0169',
  current_period_start = '2025-12-14T00:30:57+00:00',
  current_period_end = '2026-01-14T00:30:57+00:00',
  updated_at = now()
WHERE user_id = 'a51105dc-b4f8-4704-bced-fdecacaa082b';