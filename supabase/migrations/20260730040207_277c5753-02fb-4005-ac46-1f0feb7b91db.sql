-- =====================================================================
-- A4 — Escopos OAuth e escrita
-- =====================================================================

-- 1) Tokens (PAT): allowlist read/write/destructive; 'admin' proibido.
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
  v_bad    text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'invalid_name'; END IF;

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY[]::text[]) INTO v_bad
  FROM unnest(COALESCE(_scopes, ARRAY[]::text[])) AS s
  WHERE s NOT IN ('read','write','destructive');
  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_scope: %', array_to_string(v_bad, ',');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY['read']::text[])
    INTO v_scopes
  FROM unnest(COALESCE(_scopes, ARRAY['read']::text[])) AS s
  WHERE s IN ('read','write','destructive');
  IF v_scopes IS NULL OR array_length(v_scopes,1) IS NULL THEN
    v_scopes := ARRAY['read']::text[];
  END IF;
  IF NOT ('read' = ANY(v_scopes)) THEN
    v_scopes := array_append(v_scopes, 'read');
  END IF;

  v_raw    := 'lmcp_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := substr(v_raw, 1, 12);
  v_hash   := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  INSERT INTO public.assistant_mcp_tokens(user_id, name, token_prefix, token_hash, scopes, expires_at)
  VALUES (v_uid, trim(_name), v_prefix, v_hash, v_scopes, _expires_at)
  RETURNING assistant_mcp_tokens.id INTO v_id;

  RETURN QUERY SELECT v_id, v_raw, v_prefix;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_token_create(text, timestamptz, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_create(text, timestamptz, text[]) TO authenticated;

-- 2) Limpeza de dados: nenhum token permanece com 'admin'.
UPDATE public.assistant_mcp_tokens
   SET scopes = array_remove(scopes, 'admin')
 WHERE 'admin' = ANY(scopes);

UPDATE public.assistant_mcp_tokens
   SET scopes = ARRAY['read']::text[]
 WHERE scopes IS NULL OR array_length(scopes, 1) IS NULL;

-- 3) Validador filtra escopos desconhecidos na saída (defesa em profundidade).
CREATE OR REPLACE FUNCTION public.assistant_mcp_token_validate(_token text)
RETURNS TABLE(user_id uuid, token_id uuid, scopes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _row record;
  _clean text[];
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

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY['read']::text[]) INTO _clean
  FROM unnest(COALESCE(_row.scopes, ARRAY['read']::text[])) AS s
  WHERE s IN ('read','write','destructive');
  IF _clean IS NULL OR array_length(_clean,1) IS NULL THEN
    _clean := ARRAY['read']::text[];
  END IF;

  UPDATE public.assistant_mcp_tokens SET last_used_at = now() WHERE id = _row.id;
  RETURN QUERY SELECT _row.user_id, _row.id, _clean;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_token_validate(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_token_validate(text) TO service_role;

-- 4) Grants por cliente OAuth (o Supabase Auth não emite scope customizado).
CREATE TABLE IF NOT EXISTS public.assistant_mcp_client_grants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   text NOT NULL,
  client_name text,
  tiers       text[] NOT NULL DEFAULT ARRAY['read']::text[],
  last_used_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id),
  CONSTRAINT assistant_mcp_client_grants_tiers_valid
    CHECK (tiers <@ ARRAY['read','write','destructive']::text[])
);

GRANT SELECT, UPDATE, DELETE ON public.assistant_mcp_client_grants TO authenticated;
GRANT ALL ON public.assistant_mcp_client_grants TO service_role;

ALTER TABLE public.assistant_mcp_client_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own client grants select" ON public.assistant_mcp_client_grants;
CREATE POLICY "own client grants select" ON public.assistant_mcp_client_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own client grants update" ON public.assistant_mcp_client_grants;
CREATE POLICY "own client grants update" ON public.assistant_mcp_client_grants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own client grants delete" ON public.assistant_mcp_client_grants;
CREATE POLICY "own client grants delete" ON public.assistant_mcp_client_grants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_amcg_user ON public.assistant_mcp_client_grants(user_id);

-- 5) Resolver de grant usado pela edge function (service_role).
CREATE OR REPLACE FUNCTION public.assistant_mcp_grant_resolve(
  _user_id uuid,
  _client_id text,
  _client_name text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tiers text[];
BEGIN
  IF _user_id IS NULL OR _client_id IS NULL THEN RETURN ARRAY['read']::text[]; END IF;

  INSERT INTO public.assistant_mcp_client_grants(user_id, client_id, client_name, tiers, last_used_at)
  VALUES (_user_id, _client_id, _client_name, ARRAY['read']::text[], now())
  ON CONFLICT (user_id, client_id) DO UPDATE
    SET last_used_at = now(),
        client_name  = COALESCE(EXCLUDED.client_name, public.assistant_mcp_client_grants.client_name),
        updated_at   = now()
  RETURNING tiers INTO v_tiers;

  RETURN COALESCE(v_tiers, ARRAY['read']::text[]);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_grant_resolve(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_grant_resolve(uuid, text, text) TO service_role;

-- 6) Atualização de permissões pelo próprio usuário.
CREATE OR REPLACE FUNCTION public.assistant_mcp_grant_set(
  _client_id text,
  _tiers text[]
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tiers text[];
  v_bad text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _client_id IS NULL THEN RAISE EXCEPTION 'invalid_client'; END IF;

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY[]::text[]) INTO v_bad
  FROM unnest(COALESCE(_tiers, ARRAY[]::text[])) AS s
  WHERE s NOT IN ('read','write','destructive');
  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_scope: %', array_to_string(v_bad, ',');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s), ARRAY['read']::text[]) INTO v_tiers
  FROM unnest(COALESCE(_tiers, ARRAY['read']::text[])) AS s
  WHERE s IN ('read','write','destructive');
  IF v_tiers IS NULL OR array_length(v_tiers,1) IS NULL THEN
    v_tiers := ARRAY['read']::text[];
  END IF;
  IF NOT ('read' = ANY(v_tiers)) THEN
    v_tiers := array_append(v_tiers, 'read');
  END IF;

  INSERT INTO public.assistant_mcp_client_grants(user_id, client_id, tiers)
  VALUES (v_uid, _client_id, v_tiers)
  ON CONFLICT (user_id, client_id) DO UPDATE
    SET tiers = EXCLUDED.tiers, updated_at = now()
  RETURNING tiers INTO v_tiers;

  RETURN v_tiers;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_mcp_grant_set(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_mcp_grant_set(text, text[]) TO authenticated;