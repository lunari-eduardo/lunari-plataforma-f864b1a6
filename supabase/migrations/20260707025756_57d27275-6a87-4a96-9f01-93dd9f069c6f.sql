
-- Etapa 1/5 — Schema aditivo para cobrança combinada (sessão + fotos extras)
-- Retro-compatível: colunas novas são NULL para tudo que já existe; nenhum
-- caller antigo usa 'sessao_e_extras', então o CHECK novo nunca dispara para eles.

-- 1) Novas colunas de breakdown (opcionais, só obrigatórias em sessao_e_extras)
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS valor_sessao_componente numeric NULL,
  ADD COLUMN IF NOT EXISTS valor_extras_componente numeric NULL;

COMMENT ON COLUMN public.cobrancas.valor_sessao_componente IS
  'Parcela do valor referente à sessão quando finalidade = ''sessao_e_extras''. NULL nos demais casos.';
COMMENT ON COLUMN public.cobrancas.valor_extras_componente IS
  'Parcela do valor referente a fotos extras quando finalidade = ''sessao_e_extras''. NULL nos demais casos.';

-- 2) Amplia enum de finalidades para incluir sessao_e_extras
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_finalidade_chk;
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_finalidade_chk
  CHECK (finalidade IN ('sessao','fotos_extras','avulso','sessao_e_extras'));

-- 3) Constraint existente cobrancas_finalidade_galeria_chk permanece válida:
--    "finalidade <> 'sessao' OR galeria_id IS NULL" já aceita
--    sessao_e_extras com galeria_id preenchido. Nada a fazer.

-- 4) Validação do breakdown quando finalidade = 'sessao_e_extras'
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_combinada_breakdown_chk;
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_combinada_breakdown_chk
  CHECK (
    finalidade <> 'sessao_e_extras'
    OR (
      valor_sessao_componente IS NOT NULL
      AND valor_extras_componente IS NOT NULL
      AND valor_sessao_componente >= 0
      AND valor_extras_componente >= 0
      AND ROUND((valor_sessao_componente + valor_extras_componente)::numeric, 2)
          = ROUND(valor::numeric, 2)
    )
  );

-- 5) Trigger: exige vínculos mínimos (sessão, galeria, qtd_fotos > 0, valor > 0)
--    quando finalidade = 'sessao_e_extras'. Não age em nenhum outro caso.
CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige galeria_id.'
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
