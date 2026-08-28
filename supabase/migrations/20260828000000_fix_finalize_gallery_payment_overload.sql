-- 1. Destruir a versão antiga, defasada e causadora de bugs
DROP FUNCTION IF EXISTS public.finalize_gallery_payment(uuid, text, timestamp with time zone, text, text);

-- 2. Atualizar o Trigger que processa pagamentos assíncronos (PIX/Link) para usar a assinatura nova
CREATE OR REPLACE FUNCTION public.tg_auto_finalize_cobrancas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('pago','pago_manual')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago','pago_manual'))
     AND NEW.galeria_id IS NOT NULL
     AND NEW.finalidade IN ('fotos_extras','sessao_e_extras')
     AND NEW.extras_contabilizados IS NOT TRUE
  THEN
    BEGIN
      -- Chamada atualizada com a ordem nova (id, paid_at, manual_method, manual_obs, receipt_url)
      PERFORM public.finalize_gallery_payment(NEW.id, NEW.data_pagamento, NEW.metodo_manual, NEW.obs_manual, NEW.ip_receipt_url);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-finalize falhou para cobranca %: %', NEW.id, SQLERRM;
      BEGIN
        INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
        VALUES ('auto_finalize_failed','cobranca', NEW.id, NEW.galeria_id,
          jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE,'finalidade',NEW.finalidade));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$function$;
