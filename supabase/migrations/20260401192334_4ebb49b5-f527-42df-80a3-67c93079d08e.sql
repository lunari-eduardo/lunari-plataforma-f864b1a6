-- Remove expression-based index
DROP INDEX IF EXISTS idx_metas_personalizadas_unique;

-- Convert existing NULLs
UPDATE public.metas_personalizadas SET categoria = '__geral__' WHERE categoria IS NULL;

-- Alter column
ALTER TABLE public.metas_personalizadas ALTER COLUMN categoria SET DEFAULT '__geral__';
ALTER TABLE public.metas_personalizadas ALTER COLUMN categoria SET NOT NULL;

-- Add real constraint
ALTER TABLE public.metas_personalizadas 
  ADD CONSTRAINT metas_personalizadas_unique UNIQUE (user_id, ano, mes, categoria);