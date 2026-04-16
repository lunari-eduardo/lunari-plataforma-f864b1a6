-- Função: confirma appointment pendente quando valor_pago da sessão aumenta
CREATE OR REPLACE FUNCTION public.auto_confirm_appointment_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.valor_pago > COALESCE(OLD.valor_pago, 0)
     AND NEW.session_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'confirmado',
           updated_at = now()
     WHERE session_id = NEW.session_id
       AND status = 'a confirmar'
       AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_appointment ON public.clientes_sessoes;

CREATE TRIGGER trg_auto_confirm_appointment
AFTER UPDATE OF valor_pago ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_appointment_on_payment();