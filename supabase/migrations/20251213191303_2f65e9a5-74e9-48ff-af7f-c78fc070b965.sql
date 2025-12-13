-- Atualizar a função handle_new_user_profile para garantir que
-- novos usuários recebem trial de 30 dias com plano pro_monthly

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
    -- Buscar o ID do plano pro_monthly
    SELECT id INTO v_pro_plan_id FROM public.plans WHERE code = 'pro_monthly' LIMIT 1;
    
    IF v_pro_plan_id IS NOT NULL THEN
      -- Verificar se já existe subscription para este usuário
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
        
        RAISE NOTICE 'Trial subscription created for user: % with plan_id: %', NEW.email, v_pro_plan_id;
      END IF;
    ELSE
      RAISE WARNING 'pro_monthly plan not found, could not create trial for user: %', NEW.email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();