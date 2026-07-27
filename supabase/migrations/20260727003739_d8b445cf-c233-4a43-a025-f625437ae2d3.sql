
CREATE TABLE public.intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  scope_key text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  score numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  inputs_hash text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT intelligence_signals_kind_chk CHECK (
    kind IN ('session.health','finance.anomaly.month','client.at_risk')
  ),
  CONSTRAINT intelligence_signals_severity_chk CHECK (
    severity IN ('info','warn','crit')
  ),
  CONSTRAINT intelligence_signals_score_chk CHECK (score >= 0 AND score <= 1),
  CONSTRAINT intelligence_signals_reasons_size_chk CHECK (
    char_length(reasons::text) <= 4096
  ),
  CONSTRAINT intelligence_signals_unique UNIQUE (user_id, kind, scope_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_signals TO authenticated;
GRANT ALL ON public.intelligence_signals TO service_role;

ALTER TABLE public.intelligence_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intelligence_signals_owner_select"
  ON public.intelligence_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "intelligence_signals_owner_insert"
  ON public.intelligence_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intelligence_signals_owner_update"
  ON public.intelligence_signals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intelligence_signals_owner_delete"
  ON public.intelligence_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX intelligence_signals_user_kind_time_idx
  ON public.intelligence_signals (user_id, kind, computed_at DESC);

CREATE INDEX intelligence_signals_expires_idx
  ON public.intelligence_signals (expires_at);
