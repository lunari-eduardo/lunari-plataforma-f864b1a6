-- 1) Normaliza o estágio para JSON string canônica
UPDATE public.app_settings
   SET value = to_jsonb(COALESCE(NULLIF(value #>> '{}', ''), 'admin'))
 WHERE key = 'assistant_rollout_stage';

INSERT INTO public.app_settings(key, value)
SELECT 'assistant_rollout_stage', to_jsonb('admin'::text)
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'assistant_rollout_stage');

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_assistant_rollout_stage_chk;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_assistant_rollout_stage_chk
  CHECK (
    key <> 'assistant_rollout_stage'
    OR (value #>> '{}') IN ('admin','beta','geral')
  );

-- 2) RPC de troca de estágio (admin-only + auditoria)
CREATE OR REPLACE FUNCTION public.assistant_rollout_set(_stage text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _stage NOT IN ('admin','beta','geral') THEN RAISE EXCEPTION 'invalid_stage'; END IF;

  SELECT (value #>> '{}') INTO v_prev
    FROM public.app_settings WHERE key = 'assistant_rollout_stage';

  INSERT INTO public.app_settings(key, value)
  VALUES ('assistant_rollout_stage', to_jsonb(_stage))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.assistant_invocations(
    user_id, capability_id, module, kind, actor, output_status, surface, tool_name
  ) VALUES (
    v_uid, 'assistant.rollout.change', 'assistant', 'gate', 'human',
    COALESCE(v_prev,'admin') || '->' || _stage, 'app', 'assistant_rollout_set'
  );

  RETURN _stage;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_rollout_set(text) FROM public;
GRANT EXECUTE ON FUNCTION public.assistant_rollout_set(text) TO authenticated;

-- 3) Gate de rollout na emissão de credenciais MCP
CREATE OR REPLACE FUNCTION public.assistant_mcp_token_create(_name text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _scopes text[] DEFAULT ARRAY['read'::text])
 RETURNS TABLE(id uuid, token text, token_prefix text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  IF NOT public.assistant_access_allowed(v_uid) THEN RAISE EXCEPTION 'assistant_locked'; END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.assistant_mcp_grant_resolve(_user_id uuid, _client_id text, _client_name text DEFAULT NULL::text)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tiers text[];
BEGIN
  IF _user_id IS NULL OR _client_id IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  IF NOT public.assistant_access_allowed(_user_id) THEN RETURN ARRAY[]::text[]; END IF;

  INSERT INTO public.assistant_mcp_client_grants(user_id, client_id, client_name, tiers, last_used_at)
  VALUES (_user_id, _client_id, _client_name, ARRAY['read']::text[], now())
  ON CONFLICT (user_id, client_id) DO UPDATE
    SET last_used_at = now(),
        client_name  = COALESCE(EXCLUDED.client_name, public.assistant_mcp_client_grants.client_name),
        updated_at   = now()
  RETURNING tiers INTO v_tiers;

  RETURN COALESCE(v_tiers, ARRAY['read']::text[]);
END;
$function$;

-- 4) Fila de pedidos de acesso ao beta
CREATE TABLE IF NOT EXISTS public.assistant_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assistant_access_requests_one_pending
  ON public.assistant_access_requests(user_id) WHERE status = 'pending';

GRANT SELECT, INSERT ON public.assistant_access_requests TO authenticated;
GRANT UPDATE ON public.assistant_access_requests TO authenticated;
GRANT ALL ON public.assistant_access_requests TO service_role;

ALTER TABLE public.assistant_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own requests select" ON public.assistant_access_requests;
CREATE POLICY "own requests select" ON public.assistant_access_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own requests insert" ON public.assistant_access_requests;
CREATE POLICY "own requests insert" ON public.assistant_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admin requests update" ON public.assistant_access_requests;
CREATE POLICY "admin requests update" ON public.assistant_access_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_assistant_access_requests_updated ON public.assistant_access_requests;
CREATE TRIGGER trg_assistant_access_requests_updated
  BEFORE UPDATE ON public.assistant_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Decisão do admin (aprova = libera beta na mesma transação)
CREATE OR REPLACE FUNCTION public.assistant_access_request_decide(_id uuid, _approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.assistant_access_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
         decided_by = v_uid,
         decided_at = now()
   WHERE id = _id AND status = 'pending'
   RETURNING user_id INTO v_target;

  IF v_target IS NULL THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  IF _approve THEN
    INSERT INTO public.assistant_beta_access(user_id, note)
    VALUES (v_target, 'Aprovado via pedido de acesso')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN CASE WHEN _approve THEN 'approved' ELSE 'denied' END;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_access_request_decide(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.assistant_access_request_decide(uuid, boolean) TO authenticated;