-- Fix handle_new_user_profile trigger to ensure trial subscription is always created
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
  -- STEP 1: Create profile (required)
  INSERT INTO public.profiles (user_id, email, nome, avatar_url, is_onboarding_complete)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    FALSE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(profiles.nome, ''), EXCLUDED.nome),
    avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), EXCLUDED.avatar_url),
    updated_at = now();
  
  RAISE LOG 'Profile created/updated for user: %', NEW.email;
  
  -- STEP 2: Check if user is admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE LOG 'Admin role assigned to: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 3: Check if email is authorized (permanent free access)
  SELECT EXISTS(SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) INTO v_is_authorized;
  IF v_is_authorized THEN
    RAISE LOG 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 4: Get pro_monthly plan
  SELECT id INTO v_pro_plan_id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1;
  
  IF v_pro_plan_id IS NULL THEN
    RAISE LOG 'WARNING: pro_monthly plan not found, cannot create trial for user: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 5: Create trial subscription (CRITICAL - use ON CONFLICT to handle edge cases)
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    stripe_subscription_id,
    stripe_customer_id,
    cancel_at_period_end
  )
  VALUES (
    NEW.id,
    v_pro_plan_id,
    'trialing',
    now(),
    now() + INTERVAL '30 days',
    NULL,
    NULL,
    FALSE
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE LOG 'Trial subscription created for user: % with plan_id: %', NEW.email, v_pro_plan_id;
  
  RETURN NEW;
END;
$function$;

-- Create trial subscription for existing user without subscription (lisediehl2025@gmail.com)
INSERT INTO public.subscriptions (
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  stripe_subscription_id,
  stripe_customer_id,
  cancel_at_period_end
)
SELECT 
  '7b41aa6d-b258-46bf-9c82-ddd38549e7b3',
  id,
  'trialing',
  now(),
  now() + INTERVAL '30 days',
  NULL,
  NULL,
  FALSE
FROM public.plans 
WHERE code = 'pro_monthly'
ON CONFLICT (user_id) DO NOTHING;