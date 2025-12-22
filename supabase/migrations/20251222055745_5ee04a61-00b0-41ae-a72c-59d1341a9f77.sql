
-- =====================================================
-- RLS para VIEWs - Proteção de dados agregados
-- =====================================================
-- VIEWs no PostgreSQL precisam ter SECURITY INVOKER ou 
-- serem acessadas via funções SECURITY DEFINER
-- =====================================================

-- 1. EXTRATO_UNIFICADO - Já filtra por user_id internamente
-- A view já contém WHERE user_id = auth.uid() nas queries subjacentes
-- Apenas precisamos garantir que RLS está ativo nas tabelas base

-- 2. VIEWs de Analytics Admin - Restringir a admins
-- Estas views mostram dados agregados da plataforma inteira
-- Devem ser acessíveis apenas por admins

-- Criar função de verificação de admin para VIEWs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Nota: VIEWs não suportam RLS diretamente no PostgreSQL
-- A proteção vem das tabelas base que já têm RLS
-- E a aplicação deve verificar permissões antes de acessar VIEWs admin

-- Garantir que as tabelas base das VIEWs já têm RLS (já aplicado acima)
-- O extrato_unificado já filtra por user_id na própria definição da VIEW
