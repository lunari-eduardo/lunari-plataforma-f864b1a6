-- FASE 1: Corrigir dados inconsistentes

-- 1. Remover TODOS os roles de admin exceto lisediehlfotos@gmail.com
DELETE FROM public.user_roles 
WHERE role = 'admin' 
AND user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'lisediehlfotos@gmail.com'
);

-- 2. Garantir que lisediehlfotos@gmail.com tem role admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'lisediehlfotos@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Criar subscription de trial para usuários que não têm (exceto admin)
INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  u.id,
  (SELECT id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1),
  'trialing',
  now(),
  now() + INTERVAL '30 days'
FROM auth.users u
WHERE u.email != 'lisediehlfotos@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id)
AND EXISTS (SELECT 1 FROM public.plans WHERE code = 'pro_monthly');

-- FASE 2: Corrigir função get_access_state para retornar isAdmin corretamente
CREATE OR REPLACE FUNCTION public.get_access_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_sub RECORD;
  v_plan RECORD;
  v_is_admin BOOLEAN;
  v_is_vip BOOLEAN;
  v_has_plans BOOLEAN;
  v_days_remaining INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_authenticated',
      'reason', 'User not authenticated'
    );
  END IF;
  
  -- Verificar se usuário é admin (usando função has_role)
  v_is_admin := public.has_role(v_user_id, 'admin');
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'isAdmin', true,
      'isVip', false,
      'isTrial', false,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- Verificar se usuário é VIP
  SELECT EXISTS(
    SELECT 1 FROM public.vip_users 
    WHERE user_id = v_user_id 
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_vip;
  
  IF v_is_vip THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'VIP access',
      'isAdmin', false,
      'isVip', true,
      'isTrial', false,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- Verificar se existe algum plano configurado no sistema
  SELECT EXISTS(SELECT 1 FROM public.plans LIMIT 1) INTO v_has_plans;
  
  -- Se não há planos configurados, NÃO permitir acesso (sistema precisa de planos)
  IF NOT v_has_plans THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No plans configured in system',
      'isAdmin', false,
      'isVip', false
    );
  END IF;
  
  -- Buscar subscription do usuário com dados do plano
  SELECT s.*, p.code as plan_code, p.name as plan_name
  INTO v_sub
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = v_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Se não tem subscription, bloquear acesso
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No subscription found',
      'isAdmin', false,
      'isVip', false
    );
  END IF;
  
  -- Calcular dias restantes
  IF v_sub.current_period_end IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::INTEGER);
  ELSE
    v_days_remaining := 0;
  END IF;
  
  -- Verificar status da subscription - TRIAL
  IF v_sub.status = 'trialing' THEN
    IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Trial active',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'daysRemaining', v_days_remaining,
        'trialEndsAt', v_sub.current_period_end,
        'subscriptionId', v_sub.id,
        'planId', v_sub.plan_id,
        'planCode', COALESCE(v_sub.plan_code, 'pro_monthly'),
        'currentPeriodEnd', v_sub.current_period_end
      );
    ELSE
      -- Trial expirado
      RETURN jsonb_build_object(
        'status', 'trial_expired',
        'reason', 'Trial period ended',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'daysRemaining', 0,
        'trialEndsAt', v_sub.current_period_end,
        'subscriptionId', v_sub.id,
        'expiredAt', v_sub.current_period_end
      );
    END IF;
  END IF;
  
  -- Subscription ativa
  IF v_sub.status IN ('active', 'trialing') THEN
    IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Active subscription',
        'isAdmin', false,
        'isVip', false,
        'isTrial', false,
        'subscriptionId', v_sub.id,
        'planId', v_sub.plan_id,
        'planCode', v_sub.plan_code,
        'planName', v_sub.plan_name,
        'currentPeriodEnd', v_sub.current_period_end,
        'daysRemaining', v_days_remaining,
        'cancelAtPeriodEnd', v_sub.cancel_at_period_end
      );
    END IF;
  END IF;
  
  -- Subscription suspensa ou cancelada
  RETURN jsonb_build_object(
    'status', 'suspended',
    'reason', 'Subscription ' || v_sub.status,
    'isAdmin', false,
    'isVip', false,
    'subscriptionId', v_sub.id,
    'expiredAt', v_sub.current_period_end
  );
END;
$function$;