
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  capability_id TEXT NOT NULL,
  source_kind TEXT,
  severity_max TEXT NOT NULL DEFAULT 'info',
  enabled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_rules_severity_chk CHECK (severity_max IN ('info','warn','crit')),
  CONSTRAINT automation_rules_unique UNIQUE (user_id, capability_id, source_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_owner_all"
  ON public.automation_rules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  proposal_id UUID,
  capability_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  status TEXT NOT NULL,
  result JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_runs_status_chk CHECK (status IN ('ok','failed','skipped','denied','approval_required'))
);

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_runs_owner_read"
  ON public.automation_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "automation_runs_owner_insert"
  ON public.automation_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX ux_automation_runs_proposal_ok
  ON public.automation_runs(user_id, proposal_id)
  WHERE proposal_id IS NOT NULL AND status = 'ok';

CREATE INDEX ix_automation_runs_user_created
  ON public.automation_runs(user_id, created_at DESC);

INSERT INTO public.app_settings (key, value)
VALUES ('automation_enabled', to_jsonb(false))
ON CONFLICT (key) DO NOTHING;
