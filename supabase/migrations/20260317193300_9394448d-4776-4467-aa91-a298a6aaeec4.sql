
-- Add dados_extras JSONB column to cobrancas for per-charge metadata/overrides
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS dados_extras jsonb DEFAULT NULL;
