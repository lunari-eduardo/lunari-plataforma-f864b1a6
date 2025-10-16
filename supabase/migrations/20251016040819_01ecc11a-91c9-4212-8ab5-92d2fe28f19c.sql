-- Add missing columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf_cnpj text,
ADD COLUMN IF NOT EXISTS endereco_comercial text,
ADD COLUMN IF NOT EXISTS telefones text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS site_redes_sociais text[] DEFAULT '{}';

-- Update existing columns to match expected naming
COMMENT ON COLUMN public.profiles.nome IS 'Nome completo do usuário';
COMMENT ON COLUMN public.profiles.empresa IS 'Nome da empresa';
COMMENT ON COLUMN public.profiles.email IS 'Email principal';
COMMENT ON COLUMN public.profiles.telefone IS 'Telefone principal (mantido para compatibilidade)';
COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF ou CNPJ';
COMMENT ON COLUMN public.profiles.endereco_comercial IS 'Endereço comercial';
COMMENT ON COLUMN public.profiles.telefones IS 'Lista de telefones';
COMMENT ON COLUMN public.profiles.site_redes_sociais IS 'Lista de sites e redes sociais';