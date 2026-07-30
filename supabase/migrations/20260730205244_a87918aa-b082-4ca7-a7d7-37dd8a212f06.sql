-- 1) Guarda não-regressiva: só bloqueia quem CRIA o estado órfão
CREATE OR REPLACE FUNCTION public.tg_cobrancas_no_orphan_extra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite a transição galeria_id -> NULL durante a exclusão da galeria (cascata da FK).
  IF TG_OP = 'UPDATE' AND OLD.galeria_id IS NOT NULL AND NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Linha JÁ era órfã antes deste update: não bloquear updates subsequentes
  -- (desvínculo de sessão, estorno, reconciliação). Apenas impedir que o
  -- estado piore transformando outra finalidade em 'fotos_extras'.
  IF TG_OP = 'UPDATE'
     AND OLD.finalidade = 'fotos_extras'
     AND OLD.galeria_id IS NULL
     AND NEW.finalidade = 'fotos_extras'
     AND NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.finalidade = 'fotos_extras'
     AND NEW.galeria_id IS NULL
     AND COALESCE(NEW.status, 'pendente') NOT IN ('cancelado', 'expirado') THEN
    RAISE EXCEPTION 'COBRANCA_EXTRA_ORFA: cobrança de fotos_extras (id=%) requer galeria_id quando status=%',
      NEW.id, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Diagnóstico: cobranças de fotos extras sem galeria vinculada
CREATE OR REPLACE VIEW public.vw_cobrancas_extras_orfas
WITH (security_invoker = true) AS
SELECT c.id,
       c.user_id,
       c.session_id,
       c.status,
       c.valor,
       c.descricao,
       c.created_at
FROM public.cobrancas c
WHERE c.finalidade = 'fotos_extras'
  AND c.galeria_id IS NULL
  AND COALESCE(c.status, 'pendente') NOT IN ('cancelado', 'expirado');

GRANT SELECT ON public.vw_cobrancas_extras_orfas TO authenticated;
GRANT ALL ON public.vw_cobrancas_extras_orfas TO service_role;

-- 3) Exclusão da sessão travada (123 Cliente Novo — 09/09/2026)
DO $$
DECLARE
  v_session_pk uuid := '8a0e1849-aa3e-4afb-866d-e421d635be7d';
  v_session_text text;
  v_appointment uuid;
  v_user uuid;
BEGIN
  SELECT session_id, appointment_id, user_id
    INTO v_session_text, v_appointment, v_user
  FROM public.clientes_sessoes WHERE id = v_session_pk;

  IF v_session_text IS NULL THEN
    RAISE NOTICE 'Sessão já removida';
    RETURN;
  END IF;

  -- Preserva cobrança paga com gateway (desvincula), remove as demais
  UPDATE public.cobrancas
     SET session_id = NULL, updated_at = now()
   WHERE session_id = v_session_text
     AND user_id = v_user
     AND status IN ('pago','pago_manual')
     AND (mp_payment_id IS NOT NULL OR ip_transaction_nsu IS NOT NULL OR asaas_installment_id IS NOT NULL);

  DELETE FROM public.cobrancas
   WHERE session_id = v_session_text AND user_id = v_user;

  DELETE FROM public.clientes_transacoes
   WHERE session_id = v_session_text AND user_id = v_user;

  DELETE FROM public.clientes_sessoes WHERE id = v_session_pk;

  IF v_appointment IS NOT NULL THEN
    DELETE FROM public.appointments WHERE id = v_appointment AND user_id = v_user;
  END IF;
END $$;