CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_soma numeric;
BEGIN
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  -- Cascade legítimo: FK cobrancas.galeria_id ON DELETE SET NULL
  -- após exclusão física da galeria. Nenhuma coluna financeira muda.
  IF TG_OP = 'UPDATE'
     AND OLD.galeria_id IS NOT NULL
     AND NEW.galeria_id IS NULL
     AND NEW.finalidade = OLD.finalidade
     AND NEW.valor IS NOT DISTINCT FROM OLD.valor
     AND NEW.valor_sessao_componente IS NOT DISTINCT FROM OLD.valor_sessao_componente
     AND NEW.valor_extras_componente IS NOT DISTINCT FROM OLD.valor_extras_componente
     AND NEW.qtd_fotos IS NOT DISTINCT FROM OLD.qtd_fotos
     AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status
  THEN
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige galeria_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige qtd_fotos > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_sessao_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_sessao_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_extras_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_extras_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;

  v_soma := ROUND((COALESCE(NEW.valor_sessao_componente,0) + COALESCE(NEW.valor_extras_componente,0))::numeric, 2);
  IF ABS(v_soma - ROUND(NEW.valor::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos componentes (R$%) não bate com valor total (R$%).', v_soma, NEW.valor
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;