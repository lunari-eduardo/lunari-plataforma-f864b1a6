-- Tabela ultra-segura para chaves de provedores de IA
CREATE TABLE public.assistant_provider_keys (
  provider_name text PRIMARY KEY,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS: Ninguém tem permissão por padrão (Security by default)
ALTER TABLE public.assistant_provider_keys ENABLE ROW LEVEL SECURITY;

-- Garante que service_role tenha acesso total
GRANT ALL ON public.assistant_provider_keys TO service_role;
-- Nem sequer damos GRANT de SELECT para authenticated, apenas service_role e supabase_admin terão acesso real à tabela.

-- Função RPC Segura para o painel admin definir a chave (Cofre)
-- O modificador SECURITY DEFINER permite que a função burle o RLS internamente,
-- mas nós validamos o nível de acesso (role admin) dentro do código.
CREATE OR REPLACE FUNCTION public.set_assistant_provider_key(
  p_provider_name text,
  p_api_key text,
  p_model_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 1. Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. Verificar se o usuário é realmente administrador
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: you must be an admin to configure API keys';
  END IF;

  -- 3. Atualizar/Inserir a chave secreta na tabela cofre
  IF p_api_key IS NOT NULL AND p_api_key != '' THEN
    INSERT INTO public.assistant_provider_keys (provider_name, api_key, updated_at)
    VALUES (p_provider_name, p_api_key, now())
    ON CONFLICT (provider_name) DO UPDATE 
    SET api_key = EXCLUDED.api_key, updated_at = now();
  END IF;

  -- 4. Atualizar as opções de provedor e modelo na tabela pública de configurações
  -- (onde é seguro guardar nomes, mas não chaves)
  INSERT INTO public.app_settings (key, value)
  VALUES ('assistant_ai_provider', to_jsonb(p_provider_name))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.app_settings (key, value)
  VALUES ('assistant_ai_model', to_jsonb(p_model_id))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

END;
$$;
