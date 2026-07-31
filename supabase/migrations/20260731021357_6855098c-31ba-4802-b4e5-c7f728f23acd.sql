CREATE OR REPLACE FUNCTION public.tg_cobranca_confirm_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL
     AND NEW.status = 'pago'
     AND COALESCE(OLD.status, '') IS DISTINCT FROM 'pago' THEN
    UPDATE public.appointments a
       SET status = 'confirmado',
           updated_at = now()
     WHERE a.session_id = NEW.session_id
       AND a.user_id = NEW.user_id
       AND COALESCE(a.status, '') IN ('a confirmar', 'pendente');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobranca_confirm_appointment ON public.cobrancas;
CREATE TRIGGER trg_cobranca_confirm_appointment
AFTER UPDATE OF status ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.tg_cobranca_confirm_appointment();