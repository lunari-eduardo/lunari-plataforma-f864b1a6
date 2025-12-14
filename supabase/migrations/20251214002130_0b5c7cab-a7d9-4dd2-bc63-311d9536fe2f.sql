-- Fase 1 & 5: Atualizar get_access_state() para verificar allowed_emails
-- E atualizar handle_new_user_profile para não criar trial para emails autorizados

CREATE OR REPLACE FUNCTION public.get_access_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_sub RECORD;
  v_plan RECORD;
  v_is_admin BOOLEAN;
  v_is_vip BOOLEAN;
  v_is_authorized BOOLEAN;
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
  
  -- Buscar email do usuário
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- 1. Verificar se usuário é admin
  v_is_admin := public.has_role(v_user_id, 'admin');
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'isAdmin', true,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', false,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- 2. Verificar se email está na lista de autorizados (NOVO!)
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails 
    WHERE email = v_user_email
  ) INTO v_is_authorized;
  
  IF v_is_authorized THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Authorized email access',
      'isAdmin', false,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', true,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- 3. Verificar se usuário é VIP
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
      'isAuthorized', false,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- 4. Verificar se existe algum plano configurado no sistema
  SELECT EXISTS(SELECT 1 FROM public.plans LIMIT 1) INTO v_has_plans;
  
  IF NOT v_has_plans THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No plans configured in system',
      'isAdmin', false,
      'isVip', false,
      'isAuthorized', false
    );
  END IF;
  
  -- 5. Buscar subscription do usuário com dados do plano
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
      'isVip', false,
      'isAuthorized', false
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
        'isAuthorized', false,
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
        'isAuthorized', false,
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
        'isAuthorized', false,
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
    'isAuthorized', false,
    'subscriptionId', v_sub.id,
    'expiredAt', v_sub.current_period_end
  );
END;
$function$;

-- Atualizar handle_new_user_profile para não criar trial para emails autorizados
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pro_plan_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  -- Criar perfil usando dados do Google OAuth quando disponível
  INSERT INTO public.profiles (
    user_id, 
    email,
    nome,
    avatar_url
  )
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Se email = lisediehlfotos@gmail.com, criar como admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin user created: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- Verificar se email está na lista de autorizados
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails WHERE email = NEW.email
  ) INTO v_is_authorized;
  
  -- Se email está autorizado, NÃO criar trial (acesso é via allowed_emails)
  IF v_is_authorized THEN
    RAISE NOTICE 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- Para outros usuários não autorizados, criar trial de 30 dias com acesso PRO
  SELECT id INTO v_pro_plan_id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1;
  
  IF v_pro_plan_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id) THEN
      INSERT INTO public.subscriptions (
        user_id,
        plan_id,
        status,
        current_period_start,
        current_period_end
      )
      VALUES (
        NEW.id,
        v_pro_plan_id,
        'trialing',
        now(),
        now() + INTERVAL '30 days'
      );
      
      RAISE NOTICE 'Trial subscription created for user: %', NEW.email;
    END IF;
  ELSE
    RAISE WARNING 'pro_monthly plan not found, could not create trial for user: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;