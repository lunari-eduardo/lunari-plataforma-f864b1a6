-- ============================================
-- FASE 1: Infraestrutura de Banco de Dados
-- Sistema de Assinaturas com Stripe
-- ============================================

-- 1. Adicionar coluna stripe_price_id na tabela plans
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT UNIQUE;

-- 2. Adicionar colunas Stripe na tabela subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 3. Inserir planos com Price IDs do Stripe
INSERT INTO public.plans (code, name, description, price_cents, interval, features, is_active, stripe_price_id)
VALUES 
  (
    'starter_monthly', 
    'Starter', 
    'Ideal para começar', 
    1990, 
    'month', 
    '["Agenda", "CRM", "Workflow", "Configurações", "Suporte por WhatsApp"]'::jsonb, 
    true,
    'price_1SduZf2XeR5ffZtlimzh64Ox'
  ),
  (
    'starter_yearly', 
    'Starter Anual', 
    'Ideal para começar - economia no ano', 
    20990, 
    'year',
    '["Agenda", "CRM", "Workflow", "Configurações", "Suporte por WhatsApp"]'::jsonb, 
    true,
    'price_1SduaS2XeR5ffZtlfvzxTbwn'
  ),
  (
    'pro_monthly', 
    'Pro', 
    'Funcionalidades completas', 
    3790, 
    'month',
    '["Tudo do Starter", "Gestão de Leads", "Gestão de Tarefas", "Financeiro Completo", "Precificação e Metas", "Análise de Vendas", "Feed Preview", "Relatórios", "Notificações"]'::jsonb, 
    true,
    'price_1Sduh42XeR5ffZtlOQIQSp24'
  ),
  (
    'pro_yearly', 
    'Pro Anual', 
    'Funcionalidades completas - economia no ano', 
    38990, 
    'year',
    '["Tudo do Starter", "Gestão de Leads", "Gestão de Tarefas", "Financeiro Completo", "Precificação e Metas", "Análise de Vendas", "Feed Preview", "Relatórios", "Notificações"]'::jsonb, 
    true,
    'price_1Sduhh2XeR5ffZtlr8BGG7Wj'
  )
ON CONFLICT (code) DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  price_cents = EXCLUDED.price_cents,
  features = EXCLUDED.features;

-- 4. Criar tabela vip_users para liberação manual de acesso
CREATE TABLE IF NOT EXISTS public.vip_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  reason TEXT,
  granted_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ -- NULL = acesso indefinido
);

-- RLS para vip_users
ALTER TABLE public.vip_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage VIP users" ON public.vip_users
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own VIP status" ON public.vip_users
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Atualizar trigger handle_new_user_profile para criar trial de 30 dias
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_first_user BOOLEAN;
  v_pro_plan_id UUID;
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
  ELSE
    -- Para usuários não-admin, criar trial de 30 dias com acesso PRO
    SELECT id INTO v_pro_plan_id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1;
    
    IF v_pro_plan_id IS NOT NULL THEN
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
      )
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Trial subscription created for user: %', NEW.email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 6. Atualizar função get_access_state() com suporte a VIP e trial_expired
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
  
  -- Verificar se usuário é admin
  v_is_admin := public.has_role(v_user_id, 'admin');
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'isAdmin', true,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- Verificar se usuário é VIP (antes de verificar subscription)
  SELECT EXISTS(
    SELECT 1 FROM public.vip_users 
    WHERE user_id = v_user_id 
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_vip;
  
  IF v_is_vip THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'VIP access',
      'isVip', true,
      'planCode', 'pro_monthly'
    );
  END IF;
  
  -- Verificar se existe algum plano configurado no sistema
  SELECT EXISTS(SELECT 1 FROM public.plans LIMIT 1) INTO v_has_plans;
  
  -- Se não há planos configurados, permitir acesso (modo desenvolvimento)
  IF NOT v_has_plans THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Development mode - no plans configured',
      'isAdmin', false
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
  
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No subscription found'
    );
  END IF;
  
  -- Calcular dias restantes
  IF v_sub.current_period_end IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::INTEGER);
  ELSE
    v_days_remaining := 0;
  END IF;
  
  -- Verificar status da subscription
  IF v_sub.status = 'trialing' THEN
    -- Trial ainda válido?
    IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Trial active',
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
        'isTrial', true,
        'daysRemaining', 0,
        'trialEndsAt', v_sub.current_period_end,
        'subscriptionId', v_sub.id,
        'expiredAt', v_sub.current_period_end
      );
    END IF;
  END IF;
  
  IF v_sub.status IN ('active', 'trialing') THEN
    IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Active subscription',
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
  
  RETURN jsonb_build_object(
    'status', 'suspended',
    'reason', 'Subscription ' || v_sub.status,
    'subscriptionId', v_sub.id,
    'expiredAt', v_sub.current_period_end
  );
END;
$function$;