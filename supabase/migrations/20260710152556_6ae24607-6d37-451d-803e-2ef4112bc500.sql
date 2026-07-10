
-- ============================================================================
-- 1) RPC workflow_session_financials — considerar MAX(vendidas, selecionadas-incluidas)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.workflow_session_financials(p_session_id uuid)
 RETURNS TABLE(session_id uuid, valor_base_pacote numeric, valor_produtos numeric, valor_extras_bruto numeric, valor_extras_com_desconto numeric, desconto_progressivo numeric, desconto_manual numeric, valor_adicional numeric, valor_total numeric, valor_pago numeric, valor_pendente numeric, qtd_fotos_extra integer, qtd_extras_galeria integer, credito_gerado numeric, credito_utilizado numeric, credito_liquido numeric, extras_pago numeric, extras_pendente numeric, extras_liquido numeric, desconto_aplicado_extras numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_s              RECORD;
  v_gal            RECORD;
  v_regras         jsonb;
  v_produtos       numeric := 0;
  v_qtd            integer := 0;
  v_gal_qtd        integer := 0;
  v_unit_bruto     numeric := 0;
  v_unit_c_desc    numeric := 0;
  v_extras_bruto   numeric := 0;
  v_extras_c_desc  numeric := 0;
  v_base           numeric := 0;
  v_desconto       numeric := 0;
  v_adicional      numeric := 0;
  v_total          numeric := 0;
  v_pago           numeric := 0;
  v_sess_text      text;
  v_extras_pago    numeric := 0;
  v_cred_ger       numeric := 0;
  v_cred_util      numeric := 0;
  v_excedente      numeric := 0;
  v_extras_liq     numeric := 0;
  v_gal_status     text;
  v_has_paid_extras boolean := false;
  v_pre_selecao    boolean := false;
  v_resolved_gal_id uuid;
BEGIN
  SELECT s.id, s.user_id, s.session_id AS session_slug,
         s.valor_base_pacote, s.valor_foto_extra,
         s.valor_total_foto_extra, s.qtd_fotos_extra, s.valor_adicional,
         s.desconto, s.produtos_incluidos, s.valor_pago,
         s.galeria_id, s.regras_congeladas
    INTO v_s
    FROM public.clientes_sessoes s
   WHERE s.id = p_session_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_s.galeria_id IS NULL AND v_s.session_slug IS NOT NULL THEN
    SELECT g.id INTO v_resolved_gal_id
      FROM public.galerias g
     WHERE g.user_id    = v_s.user_id
       AND g.session_id = v_s.session_slug
     ORDER BY g.finalized_at DESC NULLS LAST, g.created_at DESC
     LIMIT 1;
    IF v_resolved_gal_id IS NOT NULL THEN
      v_s.galeria_id := v_resolved_gal_id;
    END IF;
  END IF;

  IF v_s.produtos_incluidos IS NOT NULL
     AND jsonb_typeof(v_s.produtos_incluidos) = 'array' THEN
    SELECT COALESCE(SUM(
             CASE WHEN p->>'tipo' = 'manual'
                  THEN COALESCE((p->>'quantidade')::numeric,0)
                       * COALESCE((p->>'valorUnitario')::numeric,0)
                  ELSE 0 END
           ), 0)
      INTO v_produtos
      FROM jsonb_array_elements(v_s.produtos_incluidos) p;
  END IF;

  IF v_s.galeria_id IS NOT NULL THEN
    SELECT g.total_fotos_extras_vendidas, g.valor_foto_extra, g.regras_congeladas,
           g.status, g.fotos_selecionadas, g.fotos_incluidas
      INTO v_gal
      FROM public.galerias g
     WHERE g.id = v_s.galeria_id;

    v_gal_qtd := COALESCE(v_gal.total_fotos_extras_vendidas, 0);

    -- CORREÇÃO: quando a galeria está com seleção finalizada, considerar
    -- SEMPRE o máximo entre o que já foi vendido e o que foi selecionado
    -- pelo cliente. Isso cobre reabertura de galeria + nova seleção
    -- (fotos_selecionadas cresce, total_fotos_extras_vendidas fica estável).
    IF v_gal.status = 'selecao_completa' THEN
      v_gal_qtd := GREATEST(
        COALESCE(v_gal.total_fotos_extras_vendidas, 0),
        COALESCE(v_gal.fotos_selecionadas, 0) - COALESCE(v_gal.fotos_incluidas, 0)
      );
    END IF;

    v_qtd        := COALESCE(NULLIF(v_gal_qtd, 0), COALESCE(v_s.qtd_fotos_extra, 0));
    v_unit_bruto := COALESCE(
      NULLIF(v_s.valor_foto_extra, 0),
      NULLIF(v_gal.valor_foto_extra, 0),
      0
    );
    v_regras := COALESCE(
      CASE WHEN jsonb_typeof(v_s.regras_congeladas) = 'object' THEN v_s.regras_congeladas END,
      v_gal.regras_congeladas
    );
    v_gal_status := v_gal.status;

    IF v_gal_status IN ('rascunho', 'enviado', 'selecao_iniciada') THEN
      SELECT EXISTS (
        SELECT 1 FROM public.cobrancas c
         WHERE c.galeria_id = v_s.galeria_id
           AND c.finalidade IN ('fotos_extras','sessao_e_extras')
           AND c.status IN ('pago','pago_manual')
      ) INTO v_has_paid_extras;

      IF NOT v_has_paid_extras THEN
        v_pre_selecao := true;
        v_qtd        := 0;
        v_gal_qtd    := 0;
      END IF;
    END IF;
  ELSE
    v_qtd        := COALESCE(v_s.qtd_fotos_extra, 0);
    v_unit_bruto := COALESCE(v_s.valor_foto_extra, 0);
    v_regras     := v_s.regras_congeladas;
  END IF;

  -- Extras brutos (sem desconto progressivo)
  v_extras_bruto := ROUND((v_qtd * v_unit_bruto)::numeric, 2);

  -- Desconto progressivo via regras congeladas (se houver)
  v_unit_c_desc  := v_unit_bruto;
  IF v_regras IS NOT NULL
     AND jsonb_typeof(v_regras->'pacote') = 'object'
     AND jsonb_typeof(v_regras->'pacote'->'descontoProgressivo') = 'array'
     AND v_qtd > 0 THEN
    DECLARE
      v_faixas jsonb := v_regras->'pacote'->'descontoProgressivo';
      v_pct    numeric := 0;
      v_faixa  jsonb;
    BEGIN
      FOR v_faixa IN SELECT * FROM jsonb_array_elements(v_faixas) LOOP
        IF v_qtd >= COALESCE((v_faixa->>'quantidade')::int, 0) THEN
          v_pct := GREATEST(v_pct, COALESCE((v_faixa->>'percentual')::numeric, 0));
        END IF;
      END LOOP;
      v_unit_c_desc := ROUND((v_unit_bruto * (1 - (v_pct/100.0)))::numeric, 2);
    END;
  END IF;

  v_extras_c_desc := ROUND((v_qtd * v_unit_c_desc)::numeric, 2);

  v_base      := COALESCE(v_s.valor_base_pacote, 0);
  v_adicional := COALESCE(v_s.valor_adicional, 0);
  v_desconto  := COALESCE(v_s.desconto, 0);

  -- Excedente do desconto manual sobre extras (Opção A)
  DECLARE
    v_desc_absorvido_sessao numeric;
  BEGIN
    v_desc_absorvido_sessao := LEAST(v_desconto, v_base + v_adicional + v_produtos);
    v_excedente := GREATEST(0, v_desconto - v_desc_absorvido_sessao);
    v_excedente := LEAST(v_excedente, v_extras_c_desc);
    v_extras_liq := GREATEST(0, v_extras_c_desc - v_excedente);
  END;

  v_total := ROUND((v_base + v_produtos + v_extras_liq + v_adicional - v_desc_absorvido_sessao)::numeric, 2);
  v_total := ROUND((v_base + v_produtos + v_extras_liq + v_adicional - LEAST(v_desconto, v_base + v_adicional + v_produtos))::numeric, 2);
  v_pago  := COALESCE(v_s.valor_pago, 0);

  -- Extras pago: soma das transações vinculadas às cobranças de extras
  IF v_s.galeria_id IS NOT NULL THEN
    SELECT COALESCE(SUM(t.valor), 0)
      INTO v_extras_pago
      FROM public.clientes_transacoes t
      JOIN public.cobrancas c ON c.id = t.cobranca_id
     WHERE c.galeria_id = v_s.galeria_id
       AND c.finalidade IN ('fotos_extras','sessao_e_extras')
       AND t.tipo = 'entrada';
  END IF;
  v_extras_pago := LEAST(v_extras_pago, v_extras_liq);

  -- Créditos
  v_sess_text := v_s.session_slug;
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'consumo' THEN valor ELSE 0 END), 0)
   INTO v_cred_ger, v_cred_util
   FROM public.cliente_creditos_ledger
  WHERE (session_id_origem = p_session_id OR session_id_consumo = p_session_id
      OR (v_sess_text IS NOT NULL AND (session_id_origem_texto = v_sess_text OR session_id_consumo_texto = v_sess_text)));

  RETURN QUERY SELECT
    p_session_id,
    v_base,
    v_produtos,
    v_extras_bruto,
    v_extras_c_desc,
    ROUND((v_extras_bruto - v_extras_c_desc)::numeric, 2),
    v_desconto,
    v_adicional,
    v_total,
    v_pago,
    GREATEST(0, ROUND((v_total - v_pago)::numeric, 2)),
    v_qtd,
    COALESCE(v_gal_qtd, 0),
    v_cred_ger,
    v_cred_util,
    GREATEST(0, v_cred_ger - v_cred_util),
    v_extras_pago,
    GREATEST(0, ROUND((v_extras_liq - v_extras_pago)::numeric, 2)),
    v_extras_liq,
    v_excedente;
END;
$function$;

-- ============================================================================
-- 2) Trigger sync_gallery_extras_to_session — reagir a nova seleção
--     mesmo com galeria já finalizada anteriormente
-- ============================================================================
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
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  -- Dispara quando a galeria ESTÁ em selecao_completa e qualquer sinal de
  -- (re)seleção mudou: status transicionou pra completa, ou o cliente
  -- alterou fotos_selecionadas/fotos_incluidas com a galeria já finalizada.
  v_selecao_atualizou := (
    NEW.status = 'selecao_completa'
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
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

    -- CORREÇÃO: quando a galeria está finalizada, qtd deve ser
    -- MAX(vendidas, selecionadas-incluidas) — nunca regredir abaixo do
    -- que o cliente selecionou.
    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa' THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = v_qtd_total,
      valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
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
        OR s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total
        OR s.valor_total_foto_extra IS DISTINCT FROM ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2)
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

  -- Propagar qtd/valor de extras quando a seleção é finalizada OU
  -- quando o cliente reabre e (re)seleciona com galeria já em selecao_completa.
  IF v_selecao_atualizou THEN
    v_qtd_total := GREATEST(
      COALESCE(NEW.total_fotos_extras_vendidas, 0),
      COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
    );
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);

    UPDATE public.clientes_sessoes s
    SET
      qtd_fotos_extra = v_qtd_total,
      valor_foto_extra = COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit_base),
      valor_total_foto_extra = ROUND((v_qtd_total * COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit_base))::numeric, 2),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total;
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

-- ============================================================================
-- 3) Backfill: reprocessar sessões cuja galeria está finalizada e ficaram
--     defasadas em relação à seleção do cliente.
-- ============================================================================
UPDATE public.clientes_sessoes s
SET
  qtd_fotos_extra = GREATEST(
    COALESCE(g.total_fotos_extras_vendidas, 0),
    COALESCE(g.fotos_selecionadas, 0) - COALESCE(g.fotos_incluidas, 0)
  ),
  valor_total_foto_extra = ROUND((
    GREATEST(
      COALESCE(g.total_fotos_extras_vendidas, 0),
      COALESCE(g.fotos_selecionadas, 0) - COALESCE(g.fotos_incluidas, 0)
    ) * COALESCE(NULLIF(s.valor_foto_extra, 0), g.valor_foto_extra, 0)
  )::numeric, 2),
  updated_at = now()
FROM public.galerias g
WHERE s.galeria_id = g.id
  AND g.status = 'selecao_completa'
  AND COALESCE(s.extras_overridden, false) = false
  AND s.qtd_fotos_extra < GREATEST(
    COALESCE(g.total_fotos_extras_vendidas, 0),
    COALESCE(g.fotos_selecionadas, 0) - COALESCE(g.fotos_incluidas, 0)
  );
