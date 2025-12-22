-- Índices compostos para otimizar queries do extrato_unificado
-- A view consulta clientes_transacoes e fin_transactions

-- Índice composto em clientes_transacoes (pagamentos)
-- Otimiza filtros por user_id + ordenação por data
CREATE INDEX IF NOT EXISTS idx_clientes_transacoes_user_data 
ON public.clientes_transacoes (user_id, data_transacao DESC);

-- Índice composto em fin_transactions (despesas)
-- Otimiza filtros por user_id + ordenação por data_vencimento
CREATE INDEX IF NOT EXISTS idx_fin_transactions_user_data 
ON public.fin_transactions (user_id, data_vencimento DESC);

-- Índice adicional para filtro por tipo em transacoes (pagamento)
CREATE INDEX IF NOT EXISTS idx_clientes_transacoes_tipo 
ON public.clientes_transacoes (tipo) WHERE tipo = 'pagamento';