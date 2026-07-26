
CREATE TABLE public.observation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_observation_events_user_time
  ON public.observation_events (user_id, occurred_at DESC);
CREATE INDEX idx_observation_events_type
  ON public.observation_events (user_id, event_type, occurred_at DESC);
CREATE INDEX idx_observation_events_entity
  ON public.observation_events (user_id, entity_type, entity_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.observation_events TO authenticated;
GRANT ALL ON public.observation_events TO service_role;

ALTER TABLE public.observation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obs_events_select_own"
  ON public.observation_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "obs_events_insert_own"
  ON public.observation_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Sem UPDATE / DELETE policies: append-only para usuários autenticados.
