-- Fix current_period_end date to match Stripe (17/01 instead of 15/01)
UPDATE public.subscriptions
SET current_period_end = '2026-01-17T02:24:46.000Z',
    updated_at = now()
WHERE stripe_subscription_id = 'sub_1SfAQ02XeR5ffZtlMI9lQXzw';