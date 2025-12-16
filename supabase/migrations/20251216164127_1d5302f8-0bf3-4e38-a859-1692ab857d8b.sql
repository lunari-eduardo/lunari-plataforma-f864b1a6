-- Improve handle_new_user_profile trigger with better error handling
-- This ensures profile and trial subscription are always created for new users

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pro_plan_id UUID;
  v_is_authorized BOOLEAN;
  v_profile_created BOOLEAN := FALSE;
  v_subscription_created BOOLEAN := FALSE;
BEGIN
  -- ========================================
  -- STEP 1: Create profile (with error handling)
  -- ========================================
  BEGIN
    INSERT INTO public.profiles (
      user_id, 
      email,
      nome,
      avatar_url,
      is_onboarding_complete
    )
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
    
    v_profile_created := TRUE;
    RAISE NOTICE 'Profile created/updated for user: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for %: %', NEW.email, SQLERRM;
    -- Don't fail the entire trigger, continue
  END;
  
  -- ========================================
  -- STEP 2: Check if user is admin (lisediehlfotos@gmail.com)
  -- ========================================
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
      
      RAISE NOTICE 'Admin user created: %', NEW.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create admin role for %: %', NEW.email, SQLERRM;
    END;
    
    RETURN NEW;
  END IF;
  
  -- ========================================
  -- STEP 3: Check if email is in allowed list
  -- ========================================
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails WHERE email = NEW.email
  ) INTO v_is_authorized;
  
  IF v_is_authorized THEN
    RAISE NOTICE 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- ========================================
  -- STEP 4: Create trial subscription for regular users
  -- ========================================
  BEGIN
    -- Get pro_monthly plan ID
    SELECT id INTO v_pro_plan_id 
    FROM public.plans 
    WHERE code = 'pro_monthly' 
    LIMIT 1;
    
    IF v_pro_plan_id IS NULL THEN
      RAISE WARNING 'pro_monthly plan not found, cannot create trial for user: %', NEW.email;
      RETURN NEW;
    END IF;
    
    -- Check if subscription already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id
    ) THEN
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
        NULL, -- No Stripe ID for trial
        NULL, -- No Stripe customer for trial
        FALSE
      );
      
      v_subscription_created := TRUE;
      RAISE NOTICE 'Trial subscription created for user: % (profile: %, subscription: %)', 
        NEW.email, v_profile_created, v_subscription_created;
    ELSE
      RAISE NOTICE 'Subscription already exists for user: %', NEW.email;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create trial subscription for %: %', NEW.email, SQLERRM;
    -- Don't fail the entire trigger
  END;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_profile();