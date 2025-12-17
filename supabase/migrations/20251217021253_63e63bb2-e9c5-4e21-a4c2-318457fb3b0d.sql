-- Add UNIQUE constraint on user_id to allow upsert operations
-- First check if constraint already exists to prevent errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscriptions_user_id_unique'
  ) THEN
    ALTER TABLE public.subscriptions 
      ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
    RAISE NOTICE 'UNIQUE constraint subscriptions_user_id_unique created';
  ELSE
    RAISE NOTICE 'UNIQUE constraint subscriptions_user_id_unique already exists';
  END IF;
END $$;