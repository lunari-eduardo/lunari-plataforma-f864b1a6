-- FASE 3: Corrigir dados existentes do admin atual
-- Primeiro, criar a etapa "Enviado para seleção" se não existir
INSERT INTO public.etapas_trabalho (user_id, nome, cor, ordem, is_system_status)
SELECT 
  'db0ca3d8-8848-4194-aa74-40d265b73849',
  'Enviado para seleção',
  '#3B82F6',
  2,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.etapas_trabalho 
  WHERE user_id = 'db0ca3d8-8848-4194-aa74-40d265b73849' 
    AND nome = 'Enviado para seleção'
);

-- Atualizar "Seleção finalizada" para is_system_status = true
UPDATE public.etapas_trabalho 
SET is_system_status = true
WHERE user_id = 'db0ca3d8-8848-4194-aa74-40d265b73849' 
  AND nome = 'Seleção finalizada';

-- Atualizar sessão do cliente Euclides para ter o status correto
UPDATE public.clientes_sessoes
SET status = 'Enviado para seleção'
WHERE session_id = 'workflow-1769466628485-wdpyfqwulbe';