-- ================================================
-- TRIGGERS PARA RECALCULAR VALOR_PAGO AUTOMATICAMENTE
-- ================================================

-- 1. Trigger para recalcular valor_pago quando clientes_transacoes mudar
-- (Este é o trigger principal que estava faltando!)
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_on_transaction ON public.clientes_transacoes;
CREATE TRIGGER trigger_recompute_session_paid_on_transaction
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_session_paid();

-- 2. Trigger para atualizar updated_at em clientes_transacoes
-- (Este provavelmente também não existe)
DROP TRIGGER IF EXISTS update_clientes_transacoes_updated_at ON public.clientes_transacoes;
CREATE TRIGGER update_clientes_transacoes_updated_at
  BEFORE UPDATE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================

-- Índice para otimizar consultas por session_id em clientes_transacoes
CREATE INDEX IF NOT EXISTS idx_clientes_transacoes_session_id 
  ON public.clientes_transacoes(session_id);

-- Índice para otimizar consultas por cliente_id
CREATE INDEX IF NOT EXISTS idx_clientes_transacoes_cliente_id 
  ON public.clientes_transacoes(cliente_id);

COMMENT ON TRIGGER trigger_recompute_session_paid_on_transaction ON public.clientes_transacoes IS 
  'Recalcula automaticamente valor_pago em clientes_sessoes quando transações são inseridas, atualizadas ou deletadas';

COMMENT ON INDEX idx_clientes_transacoes_session_id IS 
  'Índice para otimizar queries de pagamentos por sessão';

COMMENT ON INDEX idx_clientes_transacoes_cliente_id IS 
  'Índice para otimizar queries de pagamentos por cliente';