ALTER TABLE public.material_shares
ADD COLUMN IF NOT EXISTS custom_message text;
