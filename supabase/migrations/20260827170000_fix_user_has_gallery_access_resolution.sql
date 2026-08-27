-- =====================================================================
-- Migration: Fix user_has_gallery_access resolution
-- =====================================================================
-- Problema:
--   Quando o fotógrafo é autorizado via allowed_emails com planos combo
--   (ex: 'combo_completo', 'combo_pro_select2k') ou quando seu email está
--   com casing diferente ou salvo na tabela profiles, a função
--   user_has_gallery_access falhava por:
--     1. Lookup de email restrito a auth.users com casing case-sensitive;
--     2. Verificação estrita de unified_plans que falhava se o plano
--        não existisse com is_active=true e includes_select=true no banco;
--     3. Falta de suporte a plan_code NULL (que por padrão no Lunari
--        concede acesso total / combo_completo aos autorizados).
--
-- Solução:
--   1. Resolver email tanto de auth.users quanto de public.profiles;
--   2. Comparar email com allowed_emails de forma case-insensitive e com trim;
--   3. Reconhecer diretamente planos que incluem Gallery/Select:
--      - 'combo_completo', 'combo_pro_select2k', planos com prefixo 'combo_',
--        ou contendo 'galery', 'gallery', 'select';
--      - plan_code NULL em allowed_emails (padrão Lunari = combo_completo);
--      - ou unified_plans com includes_select = true;
--   4. Em assinaturas Asaas, verificar tanto s.plan_type quanto unified_plans;
--   5. Verificar admin diretamente em user_roles além de has_role.
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
  v_is_authorized  boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Admin sempre tem acesso
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role::text = 'admin'
  ) THEN
    RETURN true;
  END IF;

  BEGIN
    v_is_admin := public.has_role(_user_id, 'admin'::app_role);
    IF v_is_admin THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback silencioso se app_role casting falhar
    NULL;
  END;

  -- 2) Assinatura Asaas ativa com plano que inclui Select/Gallery
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions_asaas s
    LEFT JOIN public.unified_plans p
      ON p.id = s.plan_id
      OR p.code = s.plan_type
    WHERE s.user_id = _user_id
      AND s.status IN ('ACTIVE', 'active', 'PENDING')
      AND (
        s.plan_type LIKE 'combo_%'
        OR s.plan_type LIKE '%galery%'
        OR s.plan_type LIKE '%gallery%'
        OR s.plan_type LIKE '%select%'
        OR (COALESCE(p.is_active, true) = true AND p.includes_select = true)
      )
  ) INTO v_has_plan;

  IF v_has_plan THEN
    RETURN true;
  END IF;

  -- 3) Fallback: allowed_emails com plano que inclui Select/Gallery
  -- Obter email do fotógrafo via auth.users ou public.profiles
  SELECT COALESCE(u.email, p.email) INTO v_user_email
  FROM auth.users u
  FULL JOIN public.profiles p ON (p.user_id = u.id OR p.id = u.id)
  WHERE u.id = _user_id OR p.user_id = _user_id OR p.id = _user_id
  LIMIT 1;

  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.profiles WHERE user_id = _user_id OR id = _user_id LIMIT 1;
  END IF;

  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = _user_id LIMIT 1;
  END IF;

  IF v_user_email IS NOT NULL THEN
    SELECT true, ae.plan_code INTO v_is_authorized, v_allowed_plan
    FROM public.allowed_emails ae
    WHERE LOWER(TRIM(ae.email)) = LOWER(TRIM(v_user_email))
    LIMIT 1;

    IF v_is_authorized THEN
      -- Default para emails autorizados sem plan_code específico é combo_completo
      v_allowed_plan := COALESCE(v_allowed_plan, 'combo_completo');

      -- Planos de combo ou específicos de galeria/select concedem acesso direto
      IF v_allowed_plan LIKE 'combo_%'
         OR v_allowed_plan LIKE '%select%'
         OR v_allowed_plan LIKE '%galery%'
         OR v_allowed_plan LIKE '%gallery%'
         OR v_allowed_plan IN ('combo_completo', 'combo_pro_select2k', 'pro_galery_monthly', 'pro_galery_yearly') THEN
        RETURN true;
      END IF;

      -- Verificar na tabela unified_plans
      SELECT (p.includes_select = true AND COALESCE(p.is_active, true) = true)
      INTO v_has_plan
      FROM public.unified_plans p
      WHERE p.code = v_allowed_plan
      LIMIT 1;

      IF COALESCE(v_has_plan, false) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- 4) VIP users
  IF EXISTS (
    SELECT 1 FROM public.vip_users
    WHERE user_id = _user_id
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.user_has_gallery_access(uuid) IS
  'Fonte única de verdade para autorização Gallery. Retorna true se o usuário é admin, possui assinatura ativa/combo, está em allowed_emails com plano que inclui Gallery/Select (ou default), ou é VIP.';

GRANT EXECUTE ON FUNCTION public.user_has_gallery_access(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.user_has_gallery_access(uuid) FROM anon;
