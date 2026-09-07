-- ==============================================================================
-- Migration: 20260907140000_fix_combined_charge_validation_and_manual_flow.sql
-- Description: Blindagem definitiva da validação de cobrança combinada (sessao_e_extras)
--              e auto-resolução de componentes e fotos extras para pagamentos manuais.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_unit NUMERIC;
  v_match TEXT[];
  v_inferred_qtd INT;
BEGIN
  -- Só atua em cobranças combinadas (sessão + fotos extras)
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  -- 1) Validação de vínculo: exige session_id ou galeria_id
  IF NEW.session_id IS NULL AND NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id ou galeria_id.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2) Validação de valor total
  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor > 0.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3) Auto-recuperação / balanceamento dos componentes (sessão e extras)
  -- Garante conformidade com cobrancas_combinada_breakdown_chk
  IF NEW.valor_extras_componente IS NOT NULL AND NEW.valor_sessao_componente IS NULL THEN
    NEW.valor_sessao_componente := GREATEST(0, ROUND((NEW.valor - NEW.valor_extras_componente)::numeric, 2));
  ELSIF NEW.valor_sessao_componente IS NOT NULL AND NEW.valor_extras_componente IS NULL THEN
    NEW.valor_extras_componente := GREATEST(0, ROUND((NEW.valor - NEW.valor_sessao_componente)::numeric, 2));
  ELSIF NEW.valor_extras_componente IS NULL AND NEW.valor_sessao_componente IS NULL THEN
    -- Fallback padrão: atribui tudo a extras se vier de galeria, ou a sessão
    IF NEW.galeria_id IS NOT NULL THEN
      NEW.valor_extras_componente := NEW.valor;
      NEW.valor_sessao_componente := 0;
    ELSE
      NEW.valor_sessao_componente := NEW.valor;
      NEW.valor_extras_componente := 0;
    END IF;
  END IF;

  -- Garante que não sejam negativos
  IF NEW.valor_sessao_componente < 0 THEN
    NEW.valor_sessao_componente := 0;
  END IF;
  IF NEW.valor_extras_componente < 0 THEN
    NEW.valor_extras_componente := 0;
  END IF;

  -- Ajuste de arredondamento fino se a soma diferir por centavos de arredondamento
  IF ROUND((NEW.valor_sessao_componente + NEW.valor_extras_componente)::numeric, 2) <> ROUND(NEW.valor::numeric, 2) THEN
    NEW.valor_sessao_componente := GREATEST(0, ROUND((NEW.valor - NEW.valor_extras_componente)::numeric, 2));
  END IF;

  -- 4) Auto-inferência de qtd_fotos se nulo ou <= 0
  IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
    -- Tentativa A: tentar ler da galeria
    IF NEW.galeria_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(g.fotos_selecionadas, 0) - COALESCE(g.fotos_incluidas, 0), 0)
        INTO v_inferred_qtd
        FROM public.galerias g
       WHERE g.id = NEW.galeria_id;

      IF v_inferred_qtd IS NOT NULL AND v_inferred_qtd > 0 THEN
        NEW.qtd_fotos := v_inferred_qtd;
      END IF;
    END IF;

    -- Tentativa B: tentar ler da sessão (qtd_fotos_extra)
    IF COALESCE(NEW.qtd_fotos, 0) <= 0 AND NEW.session_id IS NOT NULL THEN
      SELECT COALESCE(s.qtd_fotos_extra, 0)
        INTO v_inferred_qtd
        FROM public.clientes_sessoes s
       WHERE s.session_id = NEW.session_id OR s.id::text = NEW.session_id
       LIMIT 1;

      IF v_inferred_qtd IS NOT NULL AND v_inferred_qtd > 0 THEN
        NEW.qtd_fotos := v_inferred_qtd;
      END IF;
    END IF;

    -- Tentativa C: inferir pela descrição ('X fotos')
    IF COALESCE(NEW.qtd_fotos, 0) <= 0 AND NEW.descricao IS NOT NULL THEN
      v_match := regexp_match(NEW.descricao, '(\d+)\s*foto', 'i');
      IF v_match IS NOT NULL THEN
        NEW.qtd_fotos := (v_match[1])::INT;
      END IF;
    END IF;

    -- Tentativa D: calcular pelo preço unitário da galeria
    IF COALESCE(NEW.qtd_fotos, 0) <= 0 AND NEW.galeria_id IS NOT NULL THEN
      SELECT NULLIF(valor_foto_extra, 0) INTO v_unit FROM public.galerias WHERE id = NEW.galeria_id;
      IF v_unit IS NOT NULL AND v_unit > 0 AND COALESCE(NEW.valor_extras_componente, 0) > 0 THEN
        NEW.qtd_fotos := GREATEST(1, ROUND(NEW.valor_extras_componente / v_unit)::INT);
      END IF;
    END IF;

    -- Fallback final de segurança para nunca falhar por falta de qtd_fotos
    IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
      NEW.qtd_fotos := 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_combined_charge_breakdown ON public.cobrancas;
CREATE TRIGGER trg_validate_combined_charge_breakdown
  BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_combined_charge_breakdown();
