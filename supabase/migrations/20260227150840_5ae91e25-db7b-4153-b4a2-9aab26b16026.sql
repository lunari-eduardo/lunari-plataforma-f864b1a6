
-- 1. Add trial columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS studio_trial_started_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS studio_trial_ends_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create start_studio_trial RPC
CREATE OR REPLACE FUNCTION public.start_studio_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_existing_trial TIMESTAMPTZ;
  v_has_subscription BOOLEAN;
  v_is_authorized BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Check if trial already exists (idempotent)
  SELECT studio_trial_ends_at INTO v_existing_trial
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_existing_trial IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reason', 'Trial already exists', 'trial_ends_at', v_existing_trial);
  END IF;

  -- Check if user has active Asaas subscription
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions_asaas
    WHERE user_id = v_user_id AND status IN ('ACTIVE', 'PENDING')
  ) INTO v_has_subscription;

  IF v_has_subscription THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Already has subscription');
  END IF;

  -- Check if email is in allowed_emails
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails WHERE email = v_user_email
  ) INTO v_is_authorized;

  IF v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Authorized email, no trial needed');
  END IF;

  -- Start 30-day trial
  UPDATE public.profiles
  SET studio_trial_started_at = now(),
      studio_trial_ends_at = now() + INTERVAL '30 days',
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'Trial started',
    'trial_ends_at', (now() + INTERVAL '30 days')::text
  );
END;
$$;

-- 3. Update get_access_state to check studio trial (replace step 5 with trial check)
CREATE OR REPLACE FUNCTION public.get_access_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_trial_started_at TIMESTAMPTZ;
  v_trial_ends_at TIMESTAMPTZ;
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
  
  -- 5. Check Studio trial (profiles columns)
  SELECT studio_trial_started_at, studio_trial_ends_at
  INTO v_trial_started_at, v_trial_ends_at
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_trial_ends_at IS NOT NULL THEN
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_trial_ends_at - now()))::INTEGER);
    
    IF v_trial_ends_at > now() THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'reason', 'Studio trial active',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'isAuthorized', false,
        'daysRemaining', v_days_remaining,
        'trialEndsAt', v_trial_ends_at,
        'planCode', 'combo_completo',
        'hasGaleryAccess', true
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'trial_expired',
        'reason', 'Studio trial expired',
        'isAdmin', false,
        'isVip', false,
        'isTrial', true,
        'isAuthorized', false,
        'daysRemaining', 0,
        'trialEndsAt', v_trial_ends_at,
        'expiredAt', v_trial_ends_at,
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
$$;

-- 4. Backfill: start trial for existing users who completed onboarding but have no subscription/allowed_email
UPDATE public.profiles p
SET studio_trial_started_at = p.created_at,
    studio_trial_ends_at = p.created_at + INTERVAL '30 days'
WHERE p.is_onboarding_complete = true
  AND p.studio_trial_ends_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions_asaas sa
    WHERE sa.user_id = p.user_id AND sa.status IN ('ACTIVE', 'PENDING')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.allowed_emails ae WHERE ae.email = p.email
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin'
  );
