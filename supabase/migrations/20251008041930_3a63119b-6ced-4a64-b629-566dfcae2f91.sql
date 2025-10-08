-- FASE 3: Eliminar duplicatas de transações
-- Script para identificar e remover transações duplicadas
-- Mantém apenas a transação mais antiga de cada grupo duplicado

-- Criar índice temporário para performance (se não existir)
CREATE INDEX IF NOT EXISTS idx_transacoes_deduplicacao 
ON public.clientes_transacoes(session_id, valor, data_transacao, tipo);

-- Deletar duplicatas mantendo apenas a mais antiga
DELETE FROM public.clientes_transacoes
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY session_id, valor, data_transacao, tipo, 
                     COALESCE(descricao, '')
        ORDER BY created_at ASC -- Mantém a mais antiga
      ) as rn
    FROM public.clientes_transacoes
    WHERE tipo = 'pagamento'
  ) t
  WHERE rn > 1 -- Remove todas exceto a primeira
);

-- Recalcular valor_pago para todas as sessões afetadas
-- O trigger existente fará isso automaticamente, mas vamos forçar
DO $$
DECLARE
  session_record RECORD;
BEGIN
  FOR session_record IN 
    SELECT DISTINCT session_id 
    FROM public.clientes_transacoes 
    WHERE tipo = 'pagamento'
  LOOP
    PERFORM public.recompute_session_paid(session_record.session_id);
  END LOOP;
END $$;

-- Log de estatísticas
DO $$
DECLARE
  total_transacoes INTEGER;
  total_sessoes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_transacoes FROM public.clientes_transacoes WHERE tipo = 'pagamento';
  SELECT COUNT(DISTINCT session_id) INTO total_sessoes FROM public.clientes_transacoes WHERE tipo = 'pagamento';
  
  RAISE NOTICE 'Limpeza concluída: % transações em % sessões', total_transacoes, total_sessoes;
END $$;