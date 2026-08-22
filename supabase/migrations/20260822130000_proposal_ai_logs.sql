-- ============================================================
-- COMERCIAL: LOG DE GERAÇÕES DE IA DO CONSTRUTOR DE PROPOSTAS
-- Registro leve (input/output/status) por usuário, para auditoria
-- das gerações do wizard e das reescritas de campo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('generate', 'outline', 'field')),
  input jsonb,
  output jsonb,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_ai_logs_user
  ON public.proposal_ai_logs(user_id, created_at DESC);

ALTER TABLE public.proposal_ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own proposal ai logs"
  ON public.proposal_ai_logs FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.proposal_ai_logs TO authenticated;
GRANT ALL ON public.proposal_ai_logs TO service_role;
