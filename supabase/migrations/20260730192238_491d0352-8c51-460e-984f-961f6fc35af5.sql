CREATE TABLE IF NOT EXISTS public.assistant_mcp_handshakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  flow_id text,
  methods text[] NOT NULL DEFAULT '{}',
  user_agent text,
  has_authorization boolean NOT NULL DEFAULT false,
  auth_source text,
  client_id text,
  user_id uuid,
  auth_reason text,
  protocol_version text,
  status integer,
  response_bytes integer,
  latency_ms integer
);

CREATE INDEX IF NOT EXISTS assistant_mcp_handshakes_created_idx ON public.assistant_mcp_handshakes (created_at DESC);

REVOKE ALL ON public.assistant_mcp_handshakes FROM anon, authenticated;
GRANT ALL ON public.assistant_mcp_handshakes TO service_role;

ALTER TABLE public.assistant_mcp_handshakes ENABLE ROW LEVEL SECURITY;