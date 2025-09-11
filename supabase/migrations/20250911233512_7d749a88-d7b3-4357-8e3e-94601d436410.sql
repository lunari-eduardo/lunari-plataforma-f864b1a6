-- Phase 1: Create unique index to prevent duplicates and add updated_at triggers

-- Create unique partial index to prevent duplicate sessions by appointment
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_sessoes_user_appointment 
ON public.clientes_sessoes (user_id, appointment_id) 
WHERE appointment_id IS NOT NULL;

-- Add updated_at triggers to tables that don't have them yet
CREATE TRIGGER update_clientes_sessoes_updated_at
    BEFORE UPDATE ON public.clientes_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_transacoes_updated_at
    BEFORE UPDATE ON public.clientes_transacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 5: Create function and triggers for automatic financial consistency
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for automatic recomputation
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers on clientes_transacoes
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_insert ON public.clientes_transacoes;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_update ON public.clientes_transacoes;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_delete ON public.clientes_transacoes;

CREATE TRIGGER trigger_recompute_session_paid_insert
    AFTER INSERT ON public.clientes_transacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid();

CREATE TRIGGER trigger_recompute_session_paid_update
    AFTER UPDATE ON public.clientes_transacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid();

CREATE TRIGGER trigger_recompute_session_paid_delete
    AFTER DELETE ON public.clientes_transacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid();