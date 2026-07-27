
CREATE TABLE public.decision_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  capability_id TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_kind TEXT NOT NULL,
  source_scope_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT decision_proposals_status_chk CHECK (status IN ('open','dismissed','accepted','expired')),
  CONSTRAINT decision_proposals_severity_chk CHECK (severity IN ('info','warn','crit')),
  CONSTRAINT decision_proposals_rationale_size_chk CHECK (octet_length(rationale::text) <= 4096),
  CONSTRAINT decision_proposals_input_size_chk CHECK (octet_length(input::text) <= 8192),
  CONSTRAINT decision_proposals_unique UNIQUE (user_id, capability_id, source_kind, source_scope_key)
);

CREATE INDEX idx_decision_proposals_user_status ON public.decision_proposals (user_id, status, computed_at DESC);
CREATE INDEX idx_decision_proposals_expires ON public.decision_proposals (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_proposals TO authenticated;
GRANT ALL ON public.decision_proposals TO service_role;

ALTER TABLE public.decision_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_proposals_own_select" ON public.decision_proposals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "decision_proposals_own_insert" ON public.decision_proposals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "decision_proposals_own_update" ON public.decision_proposals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "decision_proposals_own_delete" ON public.decision_proposals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_decision_proposals_updated_at
  BEFORE UPDATE ON public.decision_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
