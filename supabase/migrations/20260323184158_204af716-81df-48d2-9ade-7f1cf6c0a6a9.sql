-- 1. Remove duplicate trigger on clientes_transacoes
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_insert ON public.clientes_transacoes;

-- 2. Data repair: recompute valor_pago for the affected session
SELECT public.recompute_session_paid('workflow-1774277716258-xcgajp03wr');