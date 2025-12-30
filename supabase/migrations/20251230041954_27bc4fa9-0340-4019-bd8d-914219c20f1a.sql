-- ============================================
-- FASE 1: Inserir planos Pro + Galery
-- ============================================

INSERT INTO public.plans (code, name, description, price_cents, interval, is_active, features) 
VALUES
  ('pro_galery_monthly', 'Pro + Galery', 'Plano Pro com acesso a Galerias de Prova', 4990, 'month', true, 
   '["Tudo do Pro", "Galerias de Prova", "Venda de Fotos Extras", "Integração Gestão ⇄ Galeria"]'::jsonb),
  ('pro_galery_yearly', 'Pro + Galery Anual', 'Plano Pro com acesso a Galerias de Prova - economia no ano', 49990, 'year', true,
   '["Tudo do Pro", "Galerias de Prova", "Venda de Fotos Extras", "Integração Gestão ⇄ Galeria"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- FASE 2: Criar tabela galerias
-- ============================================

CREATE TABLE IF NOT EXISTS public.galerias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id TEXT, -- Vincula com clientes_sessoes.session_id
  orcamento_id UUID,
  
  -- Dados do pacote (congelados no momento da criação)
  fotos_incluidas INTEGER NOT NULL DEFAULT 0,
  valor_foto_extra NUMERIC NOT NULL DEFAULT 0,
  regras_selecao JSONB DEFAULT '{}'::jsonb,
  prazo_selecao_dias INTEGER DEFAULT 7,
  
  -- Status da galeria
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, publicada, em_selecao, finalizada
  status_pagamento TEXT DEFAULT 'sem_vendas', -- sem_vendas, pendente, pago
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  
  -- Vendas (preenchido pela Galeria futuramente)
  total_fotos_extras_vendidas INTEGER DEFAULT 0,
  valor_total_vendido NUMERIC DEFAULT 0,
  
  -- Constraint única por session_id e user_id
  UNIQUE(session_id, user_id)
);

-- ============================================
-- FASE 3: RLS para galerias
-- ============================================

ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own galleries"
  ON public.galerias FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FASE 4: Índices para galerias
-- ============================================

CREATE INDEX IF NOT EXISTS idx_galerias_user_id ON public.galerias(user_id);
CREATE INDEX IF NOT EXISTS idx_galerias_cliente_id ON public.galerias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_galerias_session_id ON public.galerias(session_id);
CREATE INDEX IF NOT EXISTS idx_galerias_status ON public.galerias(status);

-- ============================================
-- FASE 5: Trigger para updated_at em galerias
-- ============================================

CREATE TRIGGER update_galerias_updated_at
  BEFORE UPDATE ON public.galerias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FASE 6: Adicionar coluna galeria_id em clientes_sessoes
-- ============================================

ALTER TABLE public.clientes_sessoes 
  ADD COLUMN IF NOT EXISTS galeria_id UUID REFERENCES public.galerias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_galeria ON public.clientes_sessoes(galeria_id);

-- ============================================
-- FASE 7: Atualizar função get_access_state para incluir hasGaleryAccess
-- ============================================

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
  v_has_galery_access BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_authenticated',
      'reason', 'User not authenticated'
    );
  END IF;
  
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- 1. Check if user is admin (highest priority)
  v_is_admin := public.has_role(v_user_id, 'admin');
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'isAdmin', true,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', false,
      'planCode', 'pro_monthly',
      'hasGaleryAccess', true  -- Admins têm acesso total
    );
  END IF;
  
  -- 2. Check if email is in authorized list
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
      'planCode', 'pro_monthly',
      'hasGaleryAccess', false  -- Autorizados não têm galeria por padrão
    );
  END IF;
  
  -- 3. Check if user is VIP
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
      'planCode', 'pro_monthly',
      'hasGaleryAccess', true  -- VIPs têm acesso total
    );
  END IF;
  
  -- 4. Check if any plans exist in system
  SELECT EXISTS(SELECT 1 FROM public.plans LIMIT 1) INTO v_has_plans;
  
  IF NOT v_has_plans THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No plans configured in system',
      'isAdmin', false,
      'isVip', false,
      'isAuthorized', false,
      'hasGaleryAccess', false
    );
  END IF;
  
  -- 5. Fetch subscription with PRIORITY LOGIC:
  --    - Paid subscriptions (stripe_subscription_id IS NOT NULL) have priority over trials
  --    - Active status has priority over trialing
  --    - Higher price plans (PRO Galery > PRO > Starter) have priority
  --    - More recent subscriptions have priority if all else equal
  SELECT s.*, p.code as plan_code, p.name as plan_name, p.price_cents
  INTO v_sub
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = v_user_id
  ORDER BY 
    -- Priority 1: Paid subscriptions first (has stripe_subscription_id)
    CASE WHEN s.stripe_subscription_id IS NOT NULL THEN 0 ELSE 1 END ASC,
    -- Priority 2: Active status first, then trialing
    CASE 
      WHEN s.status = 'active' THEN 0 
      WHEN s.status = 'trialing' THEN 1 
      ELSE 2 
    END ASC,
    -- Priority 3: Higher price plans first (PRO Galery > PRO > Starter)
    COALESCE(p.price_cents, 0) DESC,
    -- Priority 4: Most recent subscription
    s.created_at DESC
  LIMIT 1;
  
  -- No subscription found
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'no_subscription',
      'reason', 'No subscription found',
      'isAdmin', false,
      'isVip', false,
      'isAuthorized', false,
      'hasGaleryAccess', false
    );
  END IF;
  
  -- Calculate days remaining
  IF v_sub.current_period_end IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::INTEGER);
  ELSE
    v_days_remaining := 0;
  END IF;
  
  -- Determinar se o plano tem acesso à galeria
  v_has_galery_access := v_sub.plan_code LIKE 'pro_galery%';
  
  -- CRITICAL: Check if this is a PAID subscription (has stripe_subscription_id)
  -- Paid subscriptions should NEVER be treated as trials!
  IF v_sub.stripe_subscription_id IS NOT NULL THEN
    -- This is a paid subscription
    IF v_sub.status IN ('active', 'trialing') THEN
      IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > now() THEN
        RETURN jsonb_build_object(
          'status', 'ok',
          'reason', 'Active paid subscription',
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
          'cancelAtPeriodEnd', v_sub.cancel_at_period_end,
          'stripeSubscriptionId', v_sub.stripe_subscription_id,
          'hasGaleryAccess', v_has_galery_access
        );
      END IF;
    END IF;
    
    -- Paid subscription exists but is canceled/suspended
    RETURN jsonb_build_object(
      'status', 'suspended',
      'reason', 'Subscription ' || v_sub.status,
      'isAdmin', false,
      'isVip', false,
      'isAuthorized', false,
      'subscriptionId', v_sub.id,
      'expiredAt', v_sub.current_period_end,
      'planCode', v_sub.plan_code,
      'hasGaleryAccess', false
    );
  END IF;
  
  -- This is a TRIAL subscription (no stripe_subscription_id)
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
        'currentPeriodEnd', v_sub.current_period_end,
        'hasGaleryAccess', false  -- Trial não tem acesso à galeria
      );
    ELSE
      -- Trial expired
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
        'expiredAt', v_sub.current_period_end,
        'hasGaleryAccess', false
      );
    END IF;
  END IF;
  
  -- Subscription exists but status is unknown/suspended
  RETURN jsonb_build_object(
    'status', 'suspended',
    'reason', 'Subscription ' || COALESCE(v_sub.status, 'unknown'),
    'isAdmin', false,
    'isVip', false,
    'isAuthorized', false,
    'subscriptionId', v_sub.id,
    'expiredAt', v_sub.current_period_end,
    'hasGaleryAccess', false
  );
END;
$function$;