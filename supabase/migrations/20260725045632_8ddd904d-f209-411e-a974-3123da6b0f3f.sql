
CREATE OR REPLACE FUNCTION public.assistant_mcp_token_create(
  _name TEXT,
  _expires_at TIMESTAMPTZ DEFAULT NULL,
  _scopes TEXT[] DEFAULT ARRAY['read']::TEXT[]
) RETURNS TABLE(id UUID, token TEXT, token_prefix TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_raw TEXT;
  v_prefix TEXT;
  v_hash TEXT;
  v_id UUID;
  v_scopes TEXT[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'invalid_name'; END IF;

  -- sanitize scopes: only allow known values
  SELECT COALESCE(array_agg(DISTINCT s), ARRAY['read']::TEXT[]) INTO v_scopes
  FROM unnest(COALESCE(_scopes, ARRAY['read']::TEXT[])) AS s
  WHERE s IN ('read','write','admin');
  IF v_scopes IS NULL OR array_length(v_scopes,1) IS NULL THEN v_scopes := ARRAY['read']::TEXT[]; END IF;

  v_raw := 'lmcp_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := substr(v_raw, 1, 12);
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');

  INSERT INTO public.assistant_mcp_tokens(user_id, name, token_prefix, token_hash, scopes, expires_at)
  VALUES (v_uid, trim(_name), v_prefix, v_hash, v_scopes, _expires_at)
  RETURNING assistant_mcp_tokens.id INTO v_id;

  id := v_id; token := v_raw; token_prefix := v_prefix;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_create(TEXT, TIMESTAMPTZ, TEXT[]) TO authenticated;
