-- =============================================
-- TABELA DE ESTADO E PROGRESSO DO ONBOARDING
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_onboarding_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'skipped'
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_onboarding_state_updated_at ON public.user_onboarding_state;
CREATE TRIGGER trg_user_onboarding_state_updated_at
  BEFORE UPDATE ON public.user_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- RLS
ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own onboarding state" ON public.user_onboarding_state;
CREATE POLICY "Users can view own onboarding state"
  ON public.user_onboarding_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own onboarding state" ON public.user_onboarding_state;
CREATE POLICY "Users can insert own onboarding state"
  ON public.user_onboarding_state
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own onboarding state" ON public.user_onboarding_state;
CREATE POLICY "Users can update own onboarding state"
  ON public.user_onboarding_state
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own onboarding state" ON public.user_onboarding_state;
CREATE POLICY "Users can delete own onboarding state"
  ON public.user_onboarding_state
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
