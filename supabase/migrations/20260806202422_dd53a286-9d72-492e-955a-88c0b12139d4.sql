CREATE TABLE public.google_oauth_debug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  etapa text NOT NULL,
  sucesso boolean NOT NULL DEFAULT true,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_oauth_debug TO authenticated;
GRANT ALL ON public.google_oauth_debug TO service_role;

ALTER TABLE public.google_oauth_debug ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oauth debug"
ON public.google_oauth_debug
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_google_oauth_debug_user_created
ON public.google_oauth_debug (user_id, created_at DESC);