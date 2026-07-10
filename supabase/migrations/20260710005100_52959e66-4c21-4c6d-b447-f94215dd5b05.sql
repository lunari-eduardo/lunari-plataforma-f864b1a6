-- 1) Trigger de reconciliação de crédito passa a reagir a QUALQUER coluna que
--    compõe o total da sessão. O gatilho anterior (AFTER UPDATE OF valor_total)
--    não disparava quando valor_total era recalculado por um BEFORE trigger
--    porque o Postgres avalia "UPDATE OF <col>" contra o SET da statement, não
--    contra as mudanças efetivas de NEW.*. Isso permitia crédito "fantasma"
--    de overpay quando o extra era registrado em duas etapas.
DROP TRIGGER IF EXISTS trg_auto_credit_on_sessoes ON public.clientes_sessoes;
CREATE TRIGGER trg_auto_credit_on_sessoes
  AFTER UPDATE OF
    valor_total,
    valor_base_pacote,
    qtd_fotos_extra,
    valor_foto_extra,
    valor_total_foto_extra,
    valor_adicional,
    desconto,
    produtos_incluidos
  ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_credit_overpay();

-- 2) Sync galeria → sessão passa a reagir também à finalização de seleção
--    (status vira 'selecao_completa' com fotos_selecionadas > fotos_incluidas),
--    não apenas quando há venda paga. Assim o painel expandido do workflow
--    mostra qtd/valor de extras assim que o cliente finaliza a seleção,
--    respeitando extras_overridden e o guard de pré-seleção.
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_efetivo NUMERIC;
  v_unit_base NUMERIC;
  v_qtd_pagos INT;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_finalizou BOOLEAN;
  v_qtd_selecao INT;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  -- NOVO: seleção finalizou agora (status transicionou para selecao_completa)
  v_selecao_finalizou := (
    NEW.status = 'selecao_completa'
    AND COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
    AND COALESCE(NEW.fotos_selecionadas, 0) > COALESCE(NEW.fotos_incluidas, 0)
    AND COALESCE(NEW.total_fotos_extras_vendidas, 0) = 0
  );

  IF v_extras_mudou THEN
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    SELECT COALESCE(SUM(qtd_fotos),0)::int INTO v_qtd_pagos
    FROM public.cobrancas
    WHERE galeria_id = NEW.id
      AND status IN ('pago','pago_manual')
      AND tipo_cobranca IN ('foto_extra','link','venda_galeria','card','pix');

    v_unit_efetivo := CASE
      WHEN v_qtd_pagos > 0 AND COALESCE(NEW.valor_total_vendido, 0) > 0
      THEN ROUND((NEW.valor_total_vendido / v_qtd_pagos)::numeric, 2)
      ELSE v_unit_base
    END;

    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = COALESCE(NEW.total_fotos_extras_vendidas, 0),
      valor_total_foto_extra = COALESCE(NEW.valor_total_vendido, 0),
      regras_congeladas = CASE
        WHEN s.regras_congeladas IS NOT NULL
             AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
        THEN jsonb_set(
               s.regras_congeladas,
               '{pacote,valorFotoExtraEfetivo}',
               to_jsonb(v_unit_efetivo),
               true
             )
        ELSE s.regras_congeladas
      END,
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM COALESCE(NEW.total_fotos_extras_vendidas, 0)
        OR s.valor_total_foto_extra IS DISTINCT FROM COALESCE(NEW.valor_total_vendido, 0)
        OR (
          s.regras_congeladas IS NOT NULL
          AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
          AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, -1) IS DISTINCT FROM v_unit_efetivo
        )
      );

    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1) IS DISTINCT FROM v_unit_base
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,valorFotoExtra}',
            to_jsonb(v_unit_base),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  -- NOVO: propagar qtd/valor de extras SEM venda quando cliente finaliza a seleção.
  IF v_selecao_finalizou THEN
    v_qtd_selecao := GREATEST(0,
      COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
    );
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    UPDATE public.clientes_sessoes s
    SET
      qtd_fotos_extra = v_qtd_selecao,
      valor_foto_extra = COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit_base),
      valor_total_foto_extra = ROUND((v_qtd_selecao * COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit_base))::numeric, 2),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND s.qtd_fotos_extra IS DISTINCT FROM v_qtd_selecao;
  END IF;

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