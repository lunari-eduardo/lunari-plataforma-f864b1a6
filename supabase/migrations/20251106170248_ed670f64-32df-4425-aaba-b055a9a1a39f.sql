-- Desabilitar trigger de email allowlist (modo desenvolvimento)
DROP TRIGGER IF EXISTS guard_new_user_signup ON auth.users;

-- Modificar get_access_state para permitir acesso em modo desenvolvimento
CREATE OR REPLACE FUNCTION public.get_access_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_sub RECORD;
  v_is_admin BOOLEAN;
  v_has_plans BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_authenticated',
      'reason', 'User not authenticated'
    );
  END IF;
  
  -- Verificar se usuário é admin
  v_is_admin := public.has_role(v_user_id, 'admin');
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'is_admin', true
    );
  END IF;
  
  -- Verificar se existe algum plano configurado no sistema
  SELECT EXISTS(SELECT 1 FROM public.plans LIMIT 1) INTO v_has_plans;
  
  -- Se não há planos configurados, permitir acesso (modo desenvolvimento)
  IF NOT v_has_plans THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Development mode - no plans configured',
      'is_admin', false
    );
  END IF;
  
  -- Sistema de subscriptions ativado, verificar subscription do usuário
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No subscription found'
    );
  END IF;
  
  IF v_sub.status IN ('active', 'trialing') THEN
    IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Active subscription',
        'subscription_id', v_sub.id,
        'plan_id', v_sub.plan_id,
        'current_period_end', v_sub.current_period_end
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'status', 'suspended',
    'reason', 'Subscription ' || v_sub.status,
    'subscription_id', v_sub.id,
    'expired_at', v_sub.current_period_end
  );
END;
$function$;

-- Modificar handle_new_user_profile para criar admin automático para primeiro usuário
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_is_first_user BOOLEAN;
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
  
  -- Verificar se é o primeiro usuário (nenhum role existe ainda)
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles LIMIT 1) INTO v_is_first_user;
  
  -- Se for o primeiro usuário, criar como admin automaticamente
  IF v_is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'First user created as admin: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;