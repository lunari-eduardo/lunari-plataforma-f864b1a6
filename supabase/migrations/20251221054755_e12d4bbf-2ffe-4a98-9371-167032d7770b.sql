-- Corrigir função recompute_session_paid para funcionar corretamente em triggers
-- O problema é que auth.uid() retorna NULL em contexto de trigger

CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Atualizar valor_pago diretamente (sem auth check - triggers não têm contexto auth)
  UPDATE public.clientes_sessoes
  SET 
    valor_pago = (
      SELECT COALESCE(SUM(valor), 0)
      FROM public.clientes_transacoes
      WHERE session_id = p_session_id AND tipo = 'pagamento'
    ),
    updated_at = NOW()
  WHERE session_id = p_session_id;
  
  RAISE NOTICE 'Recalculado valor_pago para session_id: %', p_session_id;
END;
$$;