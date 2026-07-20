ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS configuracoes_workflow jsonb NOT NULL DEFAULT '{}'::jsonb;