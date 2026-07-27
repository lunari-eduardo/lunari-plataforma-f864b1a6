-- ============ learning_patterns ============
CREATE TABLE public.learning_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  capability_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  dismissed_count INTEGER NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  signal_strength NUMERIC(5,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','muted')),
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT learning_patterns_unique UNIQUE (user_id, capability_id, source_kind)
);

CREATE INDEX idx_learning_patterns_user_active
  ON public.learning_patterns (user_id, status, signal_strength DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_patterns TO authenticated;
GRANT ALL ON public.learning_patterns TO service_role;

ALTER TABLE public.learning_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_patterns_owner_all"
  ON public.learning_patterns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ learning_patches ============
CREATE TABLE public.learning_patches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_id UUID NOT NULL REFERENCES public.learning_patterns(id) ON DELETE CASCADE,
  patch_kind TEXT NOT NULL CHECK (patch_kind IN ('memory.remember','memory.forget','decision.mute_source')),
  target TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','dismissed')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT learning_patches_payload_size CHECK (octet_length(payload::text) <= 8192),
  CONSTRAINT learning_patches_unique_open UNIQUE (user_id, pattern_id, patch_kind, target)
);

CREATE INDEX idx_learning_patches_user_status
  ON public.learning_patches (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_patches TO authenticated;
GRANT ALL ON public.learning_patches TO service_role;

ALTER TABLE public.learning_patches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_patches_owner_all"
  ON public.learning_patches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers (reuses existing update_updated_at_column if present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_learning_patterns_updated_at
  BEFORE UPDATE ON public.learning_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_patches_updated_at
  BEFORE UPDATE ON public.learning_patches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();