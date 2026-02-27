-- Atualizar get_access_state para ler de subscriptions_asaas em vez de subscriptions (Stripe)
-- Prioridade: Admin > Authorized > VIP > Asaas Active Sub > Trial > No Sub

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
  v_authorized_plan_code TEXT;
  v_has_plans BOOLEAN;
  v_days_remaining INTEGER;
  v_has_galery_access BOOLEAN;
  v_has_studio_access BOOLEAN;
  v_trial_sub RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_authenticated',
      'reason', 'User not authenticated'
    );
  END IF;
  
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- 1. Admin
  v_is_admin := public.has_role(v_user_id, 'admin');
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Admin access',
      'isAdmin', true,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', false,
      'planCode', 'studio_pro',
      'hasGaleryAccess', true
    );
  END IF;
  
  -- 2. Authorized emails
  SELECT plan_code INTO v_authorized_plan_code
  FROM public.allowed_emails 
  WHERE email = v_user_email;
  
  IF v_authorized_plan_code IS NOT NULL THEN
    v_has_galery_access := v_authorized_plan_code LIKE '%galery%' OR v_authorized_plan_code LIKE 'combo%';
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Authorized email access',
      'isAdmin', false,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', true,
      'planCode', COALESCE(v_authorized_plan_code, 'studio_pro'),
      'hasGaleryAccess', v_has_galery_access
    );
  END IF;
  
  -- 3. VIP
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
      'planCode', 'studio_pro',
      'hasGaleryAccess', true
    );
  END IF;
  
  -- 4. Check subscriptions_asaas for active subscription
  SELECT sa.*, up.code as plan_code, up.name as plan_name,
         up.includes_studio, up.includes_select, up.includes_transfer
  INTO v_sub
  FROM public.subscriptions_asaas sa
  LEFT JOIN public.unified_plans up ON up.code = sa.plan_type
  WHERE sa.user_id = v_user_id
    AND sa.status IN ('ACTIVE', 'PENDING')
  ORDER BY sa.value_cents DESC, sa.created_at DESC
  LIMIT 1;
  
  IF v_sub.id IS NOT NULL THEN
    IF v_sub.next_due_date IS NOT NULL THEN
      v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.next_due_date::timestamp - now()))::INTEGER);
    ELSE
      v_days_remaining := 30;
    END IF;
    
    v_has_galery_access := COALESCE(v_sub.includes_select, false) OR COALESCE(v_sub.includes_transfer, false)
      OR v_sub.plan_type LIKE 'combo%' OR v_sub.plan_type LIKE '%galery%';
    
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'Active Asaas subscription',
      'isAdmin', false,
      'isVip', false,
      'isTrial', false,
      'isAuthorized', false,
      'subscriptionId', v_sub.id,
      'planCode', COALESCE(v_sub.plan_code, v_sub.plan_type),
      'planName', v_sub.plan_name,
      'currentPeriodEnd', v_sub.next_due_date,
      'daysRemaining', v_days_remaining,
      'cancelAtPeriodEnd', v_sub.pending_downgrade_plan IS NOT NULL,
      'hasGaleryAccess', v_has_galery_access,
      'billingCycle', v_sub.billing_cycle
    );
  END IF;
  
  -- 5. Check trial (old subscriptions table)
  SELECT s.*, p.code as plan_code, p.name as plan_name
  INTO v_trial_sub
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = v_user_id
    AND s.status = 'trialing'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  IF v_trial_sub.id IS NOT NULL THEN
    IF v_trial_sub.current_period_end IS NOT NULL THEN
      v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_trial_sub.current_period_end - now()))::INTEGER);
    ELSE
      v_days_remaining := 0;
    END IF;
    
    IF v_trial_sub.current_period_end IS NOT NULL AND v_trial_sub.current_period_end > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Trial active',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'isAuthorized', false,
        'daysRemaining', v_days_remaining,
        'trialEndsAt', v_trial_sub.current_period_end,
        'subscriptionId', v_trial_sub.id,
        'planCode', COALESCE(v_trial_sub.plan_code, 'studio_pro'),
        'currentPeriodEnd', v_trial_sub.current_period_end,
        'hasGaleryAccess', false
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'trial_expired',
        'reason', 'Trial period ended',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'isAuthorized', false,
        'daysRemaining', 0,
        'trialEndsAt', v_trial_sub.current_period_end,
        'subscriptionId', v_trial_sub.id,
        'expiredAt', v_trial_sub.current_period_end,
        'hasGaleryAccess', false
      );
    END IF;
  END IF;
  
  -- 6. No subscription
  RETURN jsonb_build_object(
    'status', 'no_subscription',
    'reason', 'No subscription found',
    'isAdmin', false,
    'isVip', false,
    'isAuthorized', false,
    'hasGaleryAccess', false
  );
END;
$function$;