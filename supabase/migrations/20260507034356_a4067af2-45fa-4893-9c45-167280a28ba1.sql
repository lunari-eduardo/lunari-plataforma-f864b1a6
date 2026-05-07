-- 1. Corrigir finalize_gallery_payment: incluir 'card' e 'pix' nos filtros de SUM
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_receipt_url text DEFAULT NULL::text,
  p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_manual_method text DEFAULT NULL::text,
  p_manual_obs text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cobranca RECORD;
  v_galeria_id UUID;
  v_gallery_synced BOOLEAN := false;
  v_final_status TEXT;
  v_has_parcelas BOOLEAN;
  v_current_status TEXT;
  v_inferred_qtd INT;
  v_match TEXT[];
  v_valor_unit NUMERIC;
  v_sum_qtd INT;
  v_sum_val NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id FROM public.galerias WHERE session_id = v_cobranca.session_id LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE public.cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
      v_cobranca.galeria_id := v_galeria_id;
    END IF;
  END IF;

  -- Inferência defensiva qtd_fotos quando 0
  IF COALESCE(v_cobranca.qtd_fotos, 0) = 0 AND v_galeria_id IS NOT NULL AND v_cobranca.valor > 0 THEN
    v_inferred_qtd := NULL;
    IF v_cobranca.descricao IS NOT NULL THEN
      v_match := regexp_match(v_cobranca.descricao, '(\d+)\s*foto', 'i');
      IF v_match IS NOT NULL THEN v_inferred_qtd := (v_match[1])::INT; END IF;
    END IF;
    IF v_inferred_qtd IS NULL OR v_inferred_qtd = 0 THEN
      SELECT NULLIF(valor_foto_extra, 0) INTO v_valor_unit FROM public.galerias WHERE id = v_galeria_id;
      IF v_valor_unit IS NOT NULL AND v_valor_unit > 0 THEN
        v_inferred_qtd := ROUND(v_cobranca.valor / v_valor_unit)::INT;
      END IF;
    END IF;
    IF v_inferred_qtd IS NOT NULL AND v_inferred_qtd > 0 THEN
      UPDATE public.cobrancas SET qtd_fotos = v_inferred_qtd, updated_at = now() WHERE id = p_cobranca_id;
      v_cobranca.qtd_fotos := v_inferred_qtd;
    END IF;
  END IF;

  -- BRANCH 1: já paga — só sincroniza se necessário
  IF v_cobranca.status IN ('pago', 'pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      SELECT COALESCE(SUM(qtd_fotos), 0)::int, COALESCE(SUM(valor), 0)::numeric
      INTO v_sum_qtd, v_sum_val
      FROM public.cobrancas
      WHERE galeria_id = v_galeria_id
        AND status IN ('pago', 'pago_manual')
        AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

      UPDATE public.galerias
      SET total_fotos_extras_vendidas = v_sum_qtd,
          valor_total_vendido = v_sum_val,
          status_pagamento = v_cobranca.status,
          status_selecao = 'selecao_completa',
          finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
          updated_at = now()
      WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

      IF v_cobranca.session_id IS NOT NULL THEN
        UPDATE public.clientes_sessoes
        SET qtd_fotos_extra = v_sum_qtd,
            valor_total_foto_extra = v_sum_val,
            status_galeria = 'selecao_completa',
            status_pagamento_fotos_extra = v_cobranca.status,
            updated_at = now()
        WHERE session_id = v_cobranca.session_id;
      END IF;
      v_gallery_synced := true;
    END IF;

    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
      SET status = 'finalizado', status_selecao = 'selecao_completa',
          finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
      WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  -- BRANCH 2: Asaas com parcelas
  IF v_cobranca.provedor = 'asaas' AND v_cobranca.mp_payment_id IS NOT NULL AND p_manual_method IS NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.cobranca_parcelas WHERE cobranca_id = p_cobranca_id) INTO v_has_parcelas;
    IF v_has_parcelas THEN
      SELECT status INTO v_current_status FROM public.cobrancas WHERE id = p_cobranca_id;
      IF v_current_status IN ('pago', 'pago_manual') AND v_galeria_id IS NOT NULL THEN
        SELECT COALESCE(SUM(qtd_fotos), 0)::int, COALESCE(SUM(valor), 0)::numeric
        INTO v_sum_qtd, v_sum_val
        FROM public.cobrancas
        WHERE galeria_id = v_galeria_id
          AND status IN ('pago', 'pago_manual')
          AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

        UPDATE public.galerias
        SET total_fotos_extras_vendidas = v_sum_qtd,
            valor_total_vendido = v_sum_val,
            status_pagamento = v_current_status,
            status_selecao = 'selecao_completa',
            finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
            updated_at = now()
        WHERE id = v_galeria_id;

        UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

        IF v_cobranca.session_id IS NOT NULL THEN
          UPDATE public.clientes_sessoes
          SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
              status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_current_status,
              updated_at = now()
          WHERE session_id = v_cobranca.session_id;
        END IF;
        v_gallery_synced := true;

        IF v_cobranca.visitor_id IS NOT NULL THEN
          UPDATE public.galeria_visitantes
          SET status = 'finalizado', status_selecao = 'selecao_completa',
              finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
          WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
        END IF;
      END IF;
      RETURN jsonb_build_object('success', true, 'already_paid', false,
        'has_parcelas', true, 'current_status', v_current_status,
        'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  -- BRANCH 3: First-time finalization
  UPDATE public.cobrancas
  SET status = v_final_status,
      data_pagamento = COALESCE(data_pagamento, p_paid_at, now()),
      ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
      metodo_manual = COALESCE(p_manual_method, metodo_manual),
      obs_manual = COALESCE(p_manual_obs, obs_manual),
      updated_at = now()
  WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT COALESCE(SUM(qtd_fotos), 0)::int, COALESCE(SUM(valor), 0)::numeric
    INTO v_sum_qtd, v_sum_val
    FROM public.cobrancas
    WHERE galeria_id = v_galeria_id
      AND status IN ('pago', 'pago_manual')
      AND tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix');

    UPDATE public.galerias
    SET total_fotos_extras_vendidas = v_sum_qtd,
        valor_total_vendido = v_sum_val,
        status_pagamento = v_final_status,
        status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, p_paid_at, now()),
        updated_at = now()
    WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

    IF v_cobranca.session_id IS NOT NULL THEN
      UPDATE public.clientes_sessoes
      SET qtd_fotos_extra = v_sum_qtd, valor_total_foto_extra = v_sum_val,
          status_galeria = 'selecao_completa', status_pagamento_fotos_extra = v_final_status,
          updated_at = now()
      WHERE session_id = v_cobranca.session_id;
    END IF;
    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
    SET status = 'finalizado', status_selecao = 'selecao_completa',
        finalized_at = COALESCE(p_paid_at, now()), updated_at = now()
    WHERE id = v_cobranca.visitor_id AND status != 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id,
    'final_status', v_final_status);
END;
$function$;

-- 2. Backfill: recalcular galerias afetadas (cobranças card/pix pagas mas totais zerados ou divergentes)
WITH agg AS (
  SELECT
    c.galeria_id,
    SUM(c.qtd_fotos)::int AS sum_qtd,
    SUM(c.valor)::numeric AS sum_val
  FROM public.cobrancas c
  WHERE c.galeria_id IS NOT NULL
    AND c.status IN ('pago', 'pago_manual')
    AND c.tipo_cobranca IN ('foto_extra', 'link', 'venda_galeria', 'card', 'pix')
  GROUP BY c.galeria_id
)
UPDATE public.galerias g
SET total_fotos_extras_vendidas = agg.sum_qtd,
    valor_total_vendido = agg.sum_val,
    updated_at = now()
FROM agg
WHERE g.id = agg.galeria_id
  AND (
    COALESCE(g.total_fotos_extras_vendidas, 0) <> agg.sum_qtd
    OR ABS(COALESCE(g.valor_total_vendido, 0) - agg.sum_val) > 0.01
  );

-- 3. Backfill: propagar para clientes_sessoes (a trigger protect_session_extras_consistency
-- vai forçar consistência, mas fazemos UPDATE explícito para garantir status_pagamento_fotos_extra)
UPDATE public.clientes_sessoes s
SET qtd_fotos_extra = g.total_fotos_extras_vendidas,
    valor_total_foto_extra = g.valor_total_vendido,
    status_pagamento_fotos_extra = COALESCE(s.status_pagamento_fotos_extra, 'pago'),
    updated_at = now()
FROM public.galerias g
WHERE s.galeria_id = g.id
  AND COALESCE(g.total_fotos_extras_vendidas, 0) > 0
  AND (
    COALESCE(s.qtd_fotos_extra, 0) <> g.total_fotos_extras_vendidas
    OR ABS(COALESCE(s.valor_total_foto_extra, 0) - COALESCE(g.valor_total_vendido, 0)) > 0.01
  );