
-- Garantir coluna auth_source (idempotente)
ALTER TABLE public.assistant_invocations
  ADD COLUMN IF NOT EXISTS auth_source text;

-- Listar autorizações OAuth do usuário logado.
-- Retorna metadados do cliente OAuth (nome, escopos, timestamps).
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
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  -- A tabela auth.oauth_authorizations é criada pelo Supabase OAuth Server.
  -- Se não existir (feature ainda não ativa na instância), retorna vazio.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'oauth_authorizations'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE $q$
    SELECT
      a.id,
      a.client_id::text,
      COALESCE(c.client_name, a.client_id::text) AS client_name,
      COALESCE(a.scope::text[], ARRAY[]::text[]) AS scopes,
      a.approved_at,
      a.updated_at AS last_used_at
    FROM auth.oauth_authorizations a
    LEFT JOIN auth.oauth_clients c ON c.id = a.client_id
    WHERE a.user_id = $1
      AND a.status = 'approved'
    ORDER BY a.approved_at DESC NULLS LAST
  $q$ USING uid;
EXCEPTION WHEN OTHERS THEN
  -- Schema shape divergente entre versões — retornar vazio ao invés de quebrar UI.
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_oauth_apps_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_oauth_apps_list() TO authenticated;

-- Revogar (marcar revoked) uma autorização OAuth pertencente ao usuário.
CREATE OR REPLACE FUNCTION public.assistant_oauth_app_revoke(_authorization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  owner_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'oauth_authorizations'
  ) THEN
    RETURN false;
  END IF;

  EXECUTE 'SELECT user_id FROM auth.oauth_authorizations WHERE id = $1'
    INTO owner_id USING _authorization_id;

  IF owner_id IS NULL OR owner_id <> uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  EXECUTE $q$
    UPDATE auth.oauth_authorizations
       SET status = 'revoked', updated_at = now()
     WHERE id = $1
  $q$ USING _authorization_id;

  -- Também revoga refresh tokens dessa autorização, se a tabela existir.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'oauth_access_tokens'
  ) THEN
    BEGIN
      EXECUTE 'UPDATE auth.oauth_access_tokens SET revoked_at = now() WHERE authorization_id = $1 AND revoked_at IS NULL'
        USING _authorization_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Auditoria
  BEGIN
    INSERT INTO public.assistant_invocations (
      user_id, surface, tool_name, output_status, auth_source
    ) VALUES (
      uid, 'app', 'oauth.revoke', 'ok', 'oauth'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_oauth_app_revoke(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_oauth_app_revoke(uuid) TO authenticated;
