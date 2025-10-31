-- Add authorization check to recompute_session_paid function
CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Add authorization check: verify session belongs to authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes_sessoes 
    WHERE session_id = p_session_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: session does not belong to user';
  END IF;
  
  -- Perform the calculation only if authorized
  UPDATE public.clientes_sessoes
  SET valor_pago = (
    SELECT COALESCE(SUM(valor), 0)
    FROM public.clientes_transacoes
    WHERE session_id = p_session_id AND tipo = 'pagamento'
  )
  WHERE session_id = p_session_id;
END;
$$;