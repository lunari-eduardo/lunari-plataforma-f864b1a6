
-- F2.1: Auditoria de invocações da IA (Lu)
CREATE TABLE public.assistant_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  capability_id text NOT NULL,
  module text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('command','query')),
  actor text NOT NULL DEFAULT 'assistant' CHECK (actor IN ('assistant','user','system')),
  input_hash text,
  output_status text NOT NULL CHECK (output_status IN ('ok','error','denied','pending_approval')),
  error_message text,
  latency_ms integer,
  needs_approval boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_invocations_user_ts ON public.assistant_invocations (user_id, ts DESC);
CREATE INDEX idx_assistant_invocations_capability ON public.assistant_invocations (capability_id, ts DESC);

GRANT SELECT, INSERT ON public.assistant_invocations TO authenticated;
GRANT ALL ON public.assistant_invocations TO service_role;

ALTER TABLE public.assistant_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own invocations" ON public.assistant_invocations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own invocations" ON public.assistant_invocations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
