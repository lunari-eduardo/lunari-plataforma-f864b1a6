-- Atualizar a função handle_new_user_profile para definir
-- lisediehlfotos@gmail.com como único admin automático

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
  
  -- Se email = lisediehlfotos@gmail.com, criar como admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin user created: %', NEW.email;
  ELSE
    -- Para outros usuários, criar trial de 30 dias com acesso PRO
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Limpar roles de admin incorretos (remover todos exceto lisediehlfotos@gmail.com)
DELETE FROM public.user_roles 
WHERE role = 'admin' 
AND user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'lisediehlfotos@gmail.com'
);

-- Se lisediehlfotos@gmail.com já existe, garantir que tem role admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'lisediehlfotos@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;