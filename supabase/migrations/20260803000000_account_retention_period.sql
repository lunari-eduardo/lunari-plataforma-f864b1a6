-- Adicionar coluna de status e data de exclusão solicitada na tabela de perfis (ou tabela central de usuários se houver)
-- Assumindo que a tabela de perfis é 'profiles' baseada no padrão do projeto
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'pending_deletion', 'suspended'));

-- Criar um índice para facilitar a limpeza posterior
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested_at ON public.profiles(deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

-- Grant permissões
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.deletion_requested_at IS 'Data em que o usuário solicitou a exclusão da conta. Inicia o período de retenção de 30 dias.';
