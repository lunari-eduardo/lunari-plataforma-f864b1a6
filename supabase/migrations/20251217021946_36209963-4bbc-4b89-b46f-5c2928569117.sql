-- Manual fix for lisediehl7@gmail.com subscription
-- This user paid for starter_monthly but webhook failed to update

UPDATE public.subscriptions
SET 
  plan_id = '114d1c8e-cafe-4630-9475-41586a7b0169', -- starter_monthly
  status = 'active',
  stripe_subscription_id = 'sub_1SfA152XeR5ffZtlWrcz8cCg',
  stripe_customer_id = 'cus_TcOolV4uQpYERH',
  current_period_start = '2025-12-17T02:59:01.000Z',
  current_period_end = '2026-01-16T02:59:01.000Z',
  cancel_at_period_end = false,
  updated_at = now()
WHERE user_id = '03356369-5d90-4cee-94e0-0cc9240eb1ef';