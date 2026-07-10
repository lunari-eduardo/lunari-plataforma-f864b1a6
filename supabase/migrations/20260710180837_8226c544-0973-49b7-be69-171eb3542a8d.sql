
-- 1) Rebuild sync_gallery_extras_to_session:
--    - Preço unitário é o congelado (regras_congeladas.pacote.valorFotoExtraEfetivo).
--    - Fallback: cobrança paga (usa valor_extras_componente do combined).
--    - NUNCA mais deriva de valor_total_vendido.
--    - REMOVE as escritas em regras_congeladas.pacote.valorFotoExtra/Efetivo.
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_frozen NUMERIC;
  v_unit_from_charges NUMERIC;
  v_unit_efetivo NUMERIC;
  v_extras_paid_sum NUMERIC;
  v_extras_paid_qtd INT;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  v_selecao_atualizou := (
    NEW.status = 'selecao_completa'
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
  );

  IF v_extras_mudou OR v_selecao_atualizou THEN
    -- Preço unitário congelado (fonte de verdade)
    v_unit_frozen := NULLIF(
      (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
      0
    );

    -- Fallback: derivar do que já foi pago em cobranças de extras
    -- (usa valor_extras_componente para combined; se null, cai para valor).
    SELECT
      COALESCE(SUM(COALESCE(valor_extras_componente, valor)), 0),
      COALESCE(SUM(qtd_fotos), 0)::int
      INTO v_extras_paid_sum, v_extras_paid_qtd
    FROM public.cobrancas
    WHERE galeria_id = NEW.id
      AND status IN ('pago','pago_manual')
      AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras');

    v_unit_from_charges := CASE
      WHEN v_extras_paid_qtd > 0 AND v_extras_paid_sum > 0
      THEN ROUND((v_extras_paid_sum / v_extras_paid_qtd)::numeric, 2)
      ELSE NULL
    END;

    v_unit_efetivo := COALESCE(
      v_unit_frozen,
      v_unit_from_charges,
      ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2)
    );

    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa' THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    -- Propaga apenas qtd + valor_total (derivados). NÃO toca regras_congeladas
    -- da sessão — o preço unitário foi CONGELADO na criação da galeria e não
    -- deve ser reescrito por sincronização automática.
    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = v_qtd_total,
      valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total
        OR s.valor_total_foto_extra IS DISTINCT FROM ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2)
      );
  END IF;

  -- Propaga fotos_incluidas para regras_congeladas.pacote.fotosIncluidas
  -- (esse campo pode mudar por design — não é regra congelada de preço).
  IF v_fotos_incluidas_mudou THEN
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,fotosIncluidas}',
            to_jsonb(NEW.fotos_incluidas),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Blindar regras_congeladas.pacote.valorFotoExtra/Efetivo pós-congelamento.
--    Após criado (dataCongelamento presente), esses campos são imutáveis.
--    Escape hatch: SET LOCAL app.allow_frozen_rules_override = 'true' na mesma tx.
CREATE OR REPLACE FUNCTION public.guard_regras_congeladas_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allow TEXT;
  v_old_frozen BOOLEAN;
  v_old_valor NUMERIC;
  v_new_valor NUMERIC;
  v_old_efetivo NUMERIC;
  v_new_efetivo NUMERIC;
BEGIN
  v_allow := COALESCE(current_setting('app.allow_frozen_rules_override', true), 'false');
  IF v_allow = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.regras_congeladas IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(OLD.regras_congeladas->'pacote') IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;

  v_old_frozen := (OLD.regras_congeladas->>'dataCongelamento') IS NOT NULL;
  IF NOT v_old_frozen THEN RETURN NEW; END IF;

  v_old_valor := (OLD.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric;
  v_new_valor := (NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric;
  v_old_efetivo := (OLD.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric;
  v_new_efetivo := (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric;

  IF v_old_valor IS DISTINCT FROM v_new_valor
     OR v_old_efetivo IS DISTINCT FROM v_new_efetivo THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'regras_congeladas.pacote.valorFotoExtra(Efetivo) é imutável após dataCongelamento',
      HINT = 'Se preciso corrigir, execute SET LOCAL app.allow_frozen_rules_override = ''true'' na mesma transação.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_regras_congeladas_galerias ON public.galerias;
CREATE TRIGGER trg_guard_regras_congeladas_galerias
  BEFORE UPDATE ON public.galerias
  FOR EACH ROW
  WHEN (OLD.regras_congeladas IS DISTINCT FROM NEW.regras_congeladas)
  EXECUTE FUNCTION public.guard_regras_congeladas_immutable();

DROP TRIGGER IF EXISTS trg_guard_regras_congeladas_sessoes ON public.clientes_sessoes;
CREATE TRIGGER trg_guard_regras_congeladas_sessoes
  BEFORE UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  WHEN (OLD.regras_congeladas IS DISTINCT FROM NEW.regras_congeladas)
  EXECUTE FUNCTION public.guard_regras_congeladas_immutable();
