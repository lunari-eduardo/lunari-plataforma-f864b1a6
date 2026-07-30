-- Herança de nível de permissão entre client_ids do MESMO usuário.
-- Reconectar o conector (novo client_id) deixa de rebaixar a integração para leitura.
CREATE OR REPLACE FUNCTION public.assistant_mcp_grant_resolve(_user_id uuid, _client_id text, _client_name text DEFAULT NULL::text)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tiers     text[];
  v_inherited text[];
BEGIN
  IF _user_id IS NULL OR _client_id IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  IF NOT public.assistant_access_allowed(_user_id) THEN RETURN ARRAY[]::text[]; END IF;

  -- Maior nível já concedido por ESTE usuário nos últimos 90 dias.
  SELECT CASE
           WHEN bool_or('destructive' = ANY(g.tiers)) THEN ARRAY['read','write','destructive']
           WHEN bool_or('write'       = ANY(g.tiers)) THEN ARRAY['read','write']
           ELSE ARRAY['read']
         END
    INTO v_inherited
    FROM public.assistant_mcp_client_grants g
   WHERE g.user_id = _user_id
     AND g.updated_at > now() - interval '90 days';

  v_inherited := COALESCE(v_inherited, ARRAY['read']::text[]);

  INSERT INTO public.assistant_mcp_client_grants(user_id, client_id, client_name, tiers, last_used_at)
  VALUES (_user_id, _client_id, _client_name, v_inherited, now())
  ON CONFLICT (user_id, client_id) DO UPDATE
    SET last_used_at = now(),
        client_name  = COALESCE(EXCLUDED.client_name, public.assistant_mcp_client_grants.client_name),
        updated_at   = now()
  RETURNING tiers INTO v_tiers;

  RETURN COALESCE(v_tiers, ARRAY['read']::text[]);
END;
$function$;

-- Corrige o conector atual, que nasceu somente-leitura após a reconexão.
UPDATE public.assistant_mcp_client_grants g
   SET tiers = ARRAY['read','write','destructive']::text[], updated_at = now()
 WHERE g.tiers = ARRAY['read']::text[]
   AND EXISTS (
     SELECT 1 FROM public.assistant_mcp_client_grants h
      WHERE h.user_id = g.user_id
        AND 'destructive' = ANY(h.tiers)
        AND h.updated_at > now() - interval '90 days'
   );