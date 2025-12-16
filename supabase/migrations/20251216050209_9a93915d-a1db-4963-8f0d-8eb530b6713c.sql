-- Drop and recreate get_access_state with priority logic
-- Priority: Admin > Authorized Email > VIP > Active Paid Subscription > Trial > No Subscription
-- For paid subscriptions: PRO > Starter, Active > Trialing

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
      'planCode', 'pro_monthly'
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
      'planCode', 'pro_monthly'
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
      'planCode', 'pro_monthly'
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
      'isAuthorized', false
    );
  END IF;
  
  -- 5. Fetch subscription with PRIORITY LOGIC:
  --    - Paid subscriptions (stripe_subscription_id IS NOT NULL) have priority over trials
  --    - Active status has priority over trialing
  --    - Higher price plans (PRO > Starter) have priority
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
    -- Priority 3: Higher price plans first (PRO > Starter)
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
      'isAuthorized', false
    );
  END IF;
  
  -- Calculate days remaining
  IF v_sub.current_period_end IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::INTEGER);
  ELSE
    v_days_remaining := 0;
  END IF;
  
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
          'isTrial', false,  -- NEVER true for paid subscriptions!
          'isAuthorized', false,
          'subscriptionId', v_sub.id,
          'planId', v_sub.plan_id,
          'planCode', v_sub.plan_code,
          'planName', v_sub.plan_name,
          'currentPeriodEnd', v_sub.current_period_end,
          'daysRemaining', v_days_remaining,
          'cancelAtPeriodEnd', v_sub.cancel_at_period_end,
          'stripeSubscriptionId', v_sub.stripe_subscription_id
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
      'planCode', v_sub.plan_code
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
        'currentPeriodEnd', v_sub.current_period_end
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
        'expiredAt', v_sub.current_period_end
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
    'expiredAt', v_sub.current_period_end
  );
END;
$function$;