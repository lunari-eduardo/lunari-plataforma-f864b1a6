CREATE UNIQUE INDEX IF NOT EXISTS uniq_galerias_session_tipo
  ON public.galerias (session_id, tipo)
  WHERE session_id IS NOT NULL;