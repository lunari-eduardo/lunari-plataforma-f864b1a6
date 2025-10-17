-- Inserir perfis para usuários existentes que não têm perfil
INSERT INTO public.profiles (user_id, email, nome, is_onboarding_complete)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nome', ''),
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;