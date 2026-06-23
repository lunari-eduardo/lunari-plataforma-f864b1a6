
-- =====================================================================
-- ONDA A · Lunari Constitution v1.0 + Architecture v1.0
-- Source of truth no servidor para "este usuário pode usar Gallery?"
-- =====================================================================
-- Regra de negócio (Constituição + project-knowledge):
--   Integração Gallery ↔ Gestão só é permitida quando o fotógrafo possui
--   plano ATIVO que inclua o módulo Select (includes_select=true) — hoje:
--   combo_pro_select2k, combo_completo — OU é admin.
-- Esta função centraliza a validação para edge functions, RLS e UI.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.user_has_gallery_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin       boolean := false;
  v_has_plan       boolean := false;
  v_user_email     text;
  v_allowed_plan   text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Admin sempre tem acesso (paridade com mem://integrations/gallery/paridade-acesso-autorizacao-admin)
  v_is_admin := public.has_role(_user_id, 'admin'::app_role);
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- 2) Assinatura Asaas ativa com plano que inclui Select
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions_asaas s
    JOIN public.unified_plans p
      ON p.id = s.plan_id
      OR p.code = s.plan_type
    WHERE s.user_id = _user_id
      AND s.status IN ('ACTIVE', 'active')
      AND p.is_active = true
      AND p.includes_select = true
  ) INTO v_has_plan;

  IF v_has_plan THEN
    RETURN true;
  END IF;

  -- 3) Fallback: allowed_emails com plano que inclui Select
  SELECT u.email INTO v_user_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_user_email IS NOT NULL THEN
    SELECT ae.plan_code INTO v_allowed_plan
    FROM public.allowed_emails ae
    WHERE ae.email = v_user_email
    LIMIT 1;

    IF v_allowed_plan IS NOT NULL THEN
      SELECT (p.includes_select = true AND p.is_active = true)
      INTO v_has_plan
      FROM public.unified_plans p
      WHERE p.code = v_allowed_plan
      LIMIT 1;

      IF COALESCE(v_has_plan, false) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.user_has_gallery_access(uuid) IS
  'Onda A · Fonte única de verdade para autorização Gallery. Retorna true se o usuário é admin, possui assinatura Asaas ativa com plano includes_select=true, ou está em allowed_emails com plano que inclui Select. Usada por edge functions (gallery-create-payment) e poderá ser usada por RLS/UI.';

-- Permissões: chamável pelo cliente autenticado e pelo service role das edge functions.
GRANT EXECUTE ON FUNCTION public.user_has_gallery_access(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.user_has_gallery_access(uuid) FROM anon;
