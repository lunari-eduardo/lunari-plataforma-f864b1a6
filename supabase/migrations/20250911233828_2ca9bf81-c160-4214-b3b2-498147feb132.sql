-- Fix security warnings by setting proper search_path for functions

-- Update recompute_session_paid function with proper search_path
CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.clientes_sessoes
  SET valor_pago = (
    SELECT COALESCE(SUM(valor), 0)
    FROM public.clientes_transacoes
    WHERE session_id = p_session_id AND tipo = 'pagamento'
  )
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update trigger function with proper search_path
CREATE OR REPLACE FUNCTION public.trigger_recompute_session_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.session_id IS NOT NULL THEN
      PERFORM public.recompute_session_paid(NEW.session_id);
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.session_id IS NOT NULL THEN
      PERFORM public.recompute_session_paid(OLD.session_id);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;