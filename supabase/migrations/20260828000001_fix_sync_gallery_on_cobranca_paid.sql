-- Fixes constraint violation 500 error when processing payments for session products
CREATE OR REPLACE FUNCTION public.sync_gallery_on_cobranca_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_galeria_id uuid;
BEGIN
  IF NEW.status NOT IN ('pago','pago_manual') THEN RETURN NEW; END IF;
  IF OLD.status IN ('pago','pago_manual') THEN RETURN NEW; END IF;

  IF COALESCE(NEW.tipo_cobranca,'') IN ('pacote','plano','assinatura') THEN
    RETURN NEW;
  END IF;

  -- NUNCA inferir galeria para cobranças exclusivas de sessão, pois viola a restrição cobrancas_finalidade_galeria_chk
  IF NEW.finalidade = 'sessao' THEN
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NULL AND NEW.session_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = NEW.session_id
       AND user_id = NEW.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      NEW.galeria_id := v_galeria_id;
      -- Só definir finalidade quando NULL — nunca sobrescrever 'sessao'/'sessao_e_extras'
      IF NEW.finalidade IS NULL THEN
        NEW.finalidade := 'fotos_extras';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
