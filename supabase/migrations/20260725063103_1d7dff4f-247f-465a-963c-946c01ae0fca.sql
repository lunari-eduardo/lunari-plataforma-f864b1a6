
DROP FUNCTION IF EXISTS public.assistant_mcp_token_create(text, timestamptz);
DROP FUNCTION IF EXISTS public.assistant_mcp_token_create(text, timestamptz, text[]);

CREATE OR REPLACE FUNCTION public.assistant_mcp_token_create(
  _name       text,
  _expires_at timestamptz DEFAULT NULL,
  _scopes     text[]      DEFAULT ARRAY['read']
)
RETURNS TABLE(id uuid, token text, token_prefix text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_raw    text;
  v_prefix text;
  v_hash   text;
  v_id     uuid;
  v_scopes text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'invalid_name'; END IF;

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY['read']::text[])
    INTO v_scopes
  FROM unnest(COALESCE(_scopes, ARRAY['read']::text[])) AS s
  WHERE s IN ('read','write','admin');
  IF v_scopes IS NULL OR array_length(v_scopes,1) IS NULL THEN
    v_scopes := ARRAY['read']::text[];
  END IF;

  v_raw    := 'lmcp_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := substr(v_raw, 1, 12);
  v_hash   := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  INSERT INTO public.assistant_mcp_tokens(user_id, name, token_prefix, token_hash, scopes, expires_at)
  VALUES (v_uid, trim(_name), v_prefix, v_hash, v_scopes, _expires_at)
  RETURNING assistant_mcp_tokens.id INTO v_id;

  id := v_id; token := v_raw; token_prefix := v_prefix;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_token_create(text, timestamptz, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_create(text, timestamptz, text[]) TO authenticated;

ALTER TABLE public.assistant_invocations
  ADD COLUMN IF NOT EXISTS auth_source text;
