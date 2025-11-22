-- BLOCO D: Trigger para recomputar valor_pago automaticamente
-- Criar trigger que executa recompute_session_paid após mudanças em clientes_transacoes

-- Drop trigger se já existir
DROP TRIGGER IF EXISTS recompute_session_paid_trigger ON public.clientes_transacoes;

-- Criar trigger
CREATE TRIGGER recompute_session_paid_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.clientes_transacoes
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_session_paid();

-- Comentário explicativo
COMMENT ON TRIGGER recompute_session_paid_trigger ON public.clientes_transacoes IS 
'Trigger que automaticamente recalcula o valor_pago em clientes_sessoes sempre que uma transação é inserida, atualizada ou deletada';