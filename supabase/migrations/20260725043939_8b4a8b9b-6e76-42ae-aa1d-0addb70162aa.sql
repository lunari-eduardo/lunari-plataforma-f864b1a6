
CREATE TABLE public.assistant_mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_mcp_tokens_user ON public.assistant_mcp_tokens(user_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_mcp_tokens TO authenticated;
GRANT ALL ON public.assistant_mcp_tokens TO service_role;

ALTER TABLE public.assistant_mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp tokens owner select" ON public.assistant_mcp_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mcp tokens owner insert" ON public.assistant_mcp_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mcp tokens owner update" ON public.assistant_mcp_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mcp tokens owner delete" ON public.assistant_mcp_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Criar token: gera valor aleatório, salva apenas o hash, devolve o valor em texto UMA vez.
CREATE OR REPLACE FUNCTION public.assistant_mcp_token_create(_name text, _expires_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, token text, prefix text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _raw text;
  _token text;
  _prefix text;
  _hash text;
  _id uuid;
  _created timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;

  _raw := encode(extensions.gen_random_bytes(32), 'hex');
  _token := 'lmcp_' || _raw;
  _prefix := substring(_token, 1, 12);
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  INSERT INTO public.assistant_mcp_tokens (user_id, name, token_prefix, token_hash, expires_at)
  VALUES (_uid, trim(_name), _prefix, _hash, _expires_at)
  RETURNING assistant_mcp_tokens.id, assistant_mcp_tokens.created_at
    INTO _id, _created;

  RETURN QUERY SELECT _id, _token, _prefix, _created;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_token_create(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_create(text, timestamptz) TO authenticated;

-- Validador — SÓ para service_role (edge function).
CREATE OR REPLACE FUNCTION public.assistant_mcp_token_validate(_token text)
RETURNS TABLE(user_id uuid, token_id uuid, scopes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _row record;
BEGIN
  IF _token IS NULL OR length(_token) < 20 THEN RETURN; END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT t.id, t.user_id, t.scopes, t.revoked_at, t.expires_at
    INTO _row
    FROM public.assistant_mcp_tokens t
   WHERE t.token_hash = _hash
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;
  IF _row.revoked_at IS NOT NULL THEN RETURN; END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN RETURN; END IF;

  UPDATE public.assistant_mcp_tokens SET last_used_at = now() WHERE id = _row.id;
  RETURN QUERY SELECT _row.user_id, _row.id, _row.scopes;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_token_validate(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_validate(text) TO service_role;
