
-- Drop old check constraint
ALTER TABLE public.allowed_emails DROP CONSTRAINT IF EXISTS allowed_emails_plan_code_check;

-- Migrate all legacy values first
UPDATE public.allowed_emails SET plan_code = 'studio_starter' 
WHERE plan_code IS NULL OR plan_code NOT IN ('studio_starter', 'studio_pro', 'combo_pro_select2k', 'combo_completo');

-- Add new check constraint
ALTER TABLE public.allowed_emails ADD CONSTRAINT allowed_emails_plan_code_check
  CHECK (plan_code = ANY (ARRAY['studio_starter', 'studio_pro', 'combo_pro_select2k', 'combo_completo']));

-- Update default
ALTER TABLE public.allowed_emails ALTER COLUMN plan_code SET DEFAULT 'studio_starter';
