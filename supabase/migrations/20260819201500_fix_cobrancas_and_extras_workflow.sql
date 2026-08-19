-- Migration: 20260819201500_fix_cobrancas_and_extras_workflow.sql
-- Description: Blindagem da auto-confirmação de agendamentos e suporte a cobrança de fotos extras manuais no Workflow

-- 1) Trigger resiliente para auto-confirmação de agendamento em pagamento de cobrança
CREATE OR REPLACE FUNCTION public.tg_cobranca_confirm_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id TEXT := NEW.session_id;
  v_user_id UUID := NEW.user_id;
  v_cliente_id UUID := NEW.cliente_id;
  v_rows_updated INT := 0;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual')
     AND COALESCE(OLD.status, '') NOT IN ('pago', 'pago_manual') THEN
    
    -- 1. Resolução em cascata por session_id, UUID do appointment ou via clientes_sessoes
    IF v_session_id IS NOT NULL AND v_session_id <> '' THEN
      UPDATE public.appointments a
         SET status = 'confirmado',
             updated_at = now()
       WHERE (
              a.session_id = v_session_id
              OR a.id::text = v_session_id
              OR a.id::text = REPLACE(v_session_id, 'agenda-', '')
              OR a.id IN (
                SELECT s.appointment_id 
                FROM public.clientes_sessoes s 
                WHERE (s.id::text = v_session_id OR s.session_id = v_session_id)
                  AND s.appointment_id IS NOT NULL
              )
             )
         AND a.user_id = v_user_id
         AND COALESCE(a.status, '') IN ('a confirmar', 'pendente');
         
      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    -- 2. Fallback por cliente_id se nenhum agendamento foi atualizado e há agendamento pendente recente
    IF v_rows_updated = 0 AND v_cliente_id IS NOT NULL THEN
      UPDATE public.appointments a
         SET status = 'confirmado',
             updated_at = now()
       WHERE a.id = (
         SELECT app.id 
         FROM public.appointments app
         WHERE app.cliente_id = v_cliente_id
           AND app.user_id = v_user_id
           AND COALESCE(app.status, '') IN ('a confirmar', 'pendente')
         ORDER BY app.created_at DESC
         LIMIT 1
       );
    END IF;

  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cobranca_confirm_appointment ON public.cobrancas;
CREATE TRIGGER trg_cobranca_confirm_appointment
AFTER INSERT OR UPDATE OF status ON public.cobrancas
FOR EACH ROW EXECUTE FUNCTION public.tg_cobranca_confirm_appointment();

-- 2) Flexibilização da validação de cobrança combinada / fotos extras originadas no Workflow
CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  -- Permite cobrança combinada ou só de extras mesmo sem galeria_id (originada do Workflow) se session_id estiver preenchido
  IF NEW.session_id IS NULL AND NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id ou galeria_id.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige qtd_fotos > 0.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor > 0.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_combined_charge_breakdown ON public.cobrancas;
CREATE TRIGGER trg_validate_combined_charge_breakdown
  BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_combined_charge_breakdown();
