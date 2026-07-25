
CREATE OR REPLACE FUNCTION public.assistant_oauth_apps_list()
RETURNS TABLE (
  id uuid,
  client_id text,
  client_name text,
  scopes text[],
  approved_at timestamptz,
  last_used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- O schema do Supabase OAuth Server ainda é beta; tentamos ler
  -- da tabela oficial e degradamos silenciosamente se não existir.
  BEGIN
    RETURN QUERY EXECUTE $q$
      SELECT
        a.id::uuid,
        a.client_id::text,
        COALESCE(c.client_name, c.name, a.client_id)::text AS client_name,
        COALESCE(a.scopes, ARRAY['read']::text[]) AS scopes,
        a.approved_at::timestamptz,
        a.last_used_at::timestamptz
      FROM auth.oauth_authorizations a
      LEFT JOIN auth.oauth_clients c ON c.id = a.client_id
      WHERE a.user_id = $1
        AND a.revoked_at IS NULL
      ORDER BY COALESCE(a.approved_at, a.created_at) DESC
    $q$ USING _uid;
  EXCEPTION WHEN undefined_table OR undefined_column OR undefined_object THEN
    RETURN;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_oauth_app_revoke(_authorization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  BEGIN
    EXECUTE $q$
      UPDATE auth.oauth_authorizations
      SET revoked_at = now()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    $q$ USING _authorization_id, _uid;
    RETURN true;
  EXCEPTION WHEN undefined_table OR undefined_column OR undefined_object THEN
    RETURN false;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_oauth_apps_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assistant_oauth_app_revoke(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_oauth_apps_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_oauth_app_revoke(uuid) TO authenticated;
