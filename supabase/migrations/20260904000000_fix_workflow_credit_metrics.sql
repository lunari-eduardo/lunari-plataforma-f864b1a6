-- ==============================================================================
-- Migração: Correção do cálculo de créditos no Workflow
-- Data: 2026-09-04
-- Objetivo:
--   1. workflow_month_metrics: deduzir reversões ('reversao_grant') do crédito
--      gerado por sessão, e 'reversao_consumo' dos créditos utilizados.
--   2. workflow_range_metrics: mesma lógica por bucket e por sessão.
--   3. workflow_session_financials: cálculo líquido por sessão e correção de
--      ambiguidade em galerias.session_id.
--   4. Reconciliação das 2 duplicatas históricas de reversão de 04/07/2026.
-- ==============================================================================

-- 1. Limpeza segura das 2 duplicatas idênticas geradas no milissegundo 2026-07-04 19:06:50.417149+00
DELETE FROM public.cliente_creditos_ledger
WHERE id IN (
  '574fc318-08d7-48de-91a3-cee965479fba', -- Duplicata de Lisiane - Otávio
  '7374b8d3-660a-4e99-b82d-ed78e2ee560a'  -- Duplicata de Maju - Vicente
);

-- 2. Atualização de workflow_month_metrics
CREATE OR REPLACE FUNCTION public.workflow_month_metrics(p_user_id uuid, p_start date, p_end date)
 RETURNS TABLE(previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sess AS (
    SELECT id, session_id,
            COALESCE(valor_total, 0) AS valor_total,
            COALESCE(valor_pago, 0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow', 'venda_avulsa'))
       AND (status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_agg AS (
    SELECT
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess
  ),
  cred_ger AS (
    SELECT COALESCE(SUM(v_sess), 0) AS v
    FROM (
      SELECT GREATEST(SUM(l.valor), 0) AS v_sess
        FROM public.cliente_creditos_ledger l
        JOIN sess s
          ON s.session_id = l.session_id_origem
          OR s.id::text   = l.session_id_origem
       WHERE l.user_id = p_user_id
         AND l.origem IN ('overpay', 'reducao_escopo', 'reversao_grant', 'reconcile_sobra', 'estorno_para_credito')
       GROUP BY s.id
    ) sub
  ),
  cred_uso AS (
    SELECT COALESCE(SUM(v_sess), 0) AS v
    FROM (
      SELECT GREATEST(SUM(-l.valor), 0) AS v_sess
        FROM public.cliente_creditos_ledger l
        JOIN sess s
          ON s.session_id = l.session_id_consumo
          OR s.id::text   = l.session_id_consumo
       WHERE l.user_id = p_user_id
         AND l.origem IN ('consumo_desconto', 'reversao_consumo')
       GROUP BY s.id
    ) sub
  ),
  caixa_tx AS (
    SELECT
      CASE
        WHEN t.tipo = 'pagamento' THEN t.valor
        WHEN t.tipo = 'estorno'   THEN -t.valor
        ELSE 0
      END AS v
    FROM public.clientes_transacoes t
    LEFT JOIN public.cobrancas c ON t.cobranca_id = c.id
    WHERE t.user_id = p_user_id
      AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
      AND (c.provedor IS DISTINCT FROM 'asaas' OR c.id IS NULL)
      AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
      AND t.data_transacao BETWEEN p_start AND p_end
  ),
  caixa_gw AS (
    SELECT gm.amount AS v
    FROM public.gateway_cash_movements gm
    JOIN public.cobrancas c ON c.id = gm.cobranca_id
    WHERE c.user_id = p_user_id
      AND gm.movement_date::date BETWEEN p_start AND p_end
  ),
  caixa_combined AS (
    SELECT v FROM caixa_tx
    UNION ALL
    SELECT v FROM caixa_gw
  ),
  caixa AS (
    SELECT COALESCE(SUM(v), 0) AS v FROM caixa_combined
  )
  SELECT sa.previsto, sa.receita, sa.pendente, sa.sessoes,
         cg.v, cu.v, cx.v
    FROM sess_agg sa, cred_ger cg, cred_uso cu, caixa cx;
$function$;

-- 3. Atualização de workflow_range_metrics
CREATE OR REPLACE FUNCTION public.workflow_range_metrics(p_user_id uuid, p_start date, p_end date, p_granularity text DEFAULT 'month'::text, p_include_historico boolean DEFAULT false)
 RETURNS TABLE(bucket_key text, bucket_start date, previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gran text := lower(coalesce(p_granularity, 'month'));
BEGIN
  IF p_end < p_start THEN
    RAISE EXCEPTION 'end date must be >= start date';
  END IF;
  IF (p_end - p_start) > 400 THEN
    RAISE EXCEPTION 'range too large: max 400 days';
  END IF;
  IF v_gran NOT IN ('day', 'month', 'quarter', 'year', 'total') THEN
    RAISE EXCEPTION 'invalid granularity: %', v_gran;
  END IF;

  RETURN QUERY
  WITH sess AS (
    SELECT id, session_id, data_sessao,
           COALESCE(valor_total, 0) AS valor_total,
           COALESCE(valor_pago, 0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow', 'venda_avulsa'))
       AND (p_include_historico OR status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_bucketed AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(data_sessao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', data_sessao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', data_sessao), 'YYYY') || '-Q' || extract(quarter FROM data_sessao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', data_sessao), 'YYYY')
      END AS bkey,
      CASE
        WHEN v_gran = 'total' THEN p_start
        WHEN v_gran = 'day'   THEN data_sessao
        WHEN v_gran = 'month' THEN date_trunc('month', data_sessao)::date
        WHEN v_gran = 'quarter' THEN date_trunc('quarter', data_sessao)::date
        WHEN v_gran = 'year'  THEN date_trunc('year', data_sessao)::date
      END AS bstart,
      valor_total, valor_pago, id, session_id
    FROM sess
  ),
  sess_agg AS (
    SELECT
      bkey, bstart,
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess_bucketed
    GROUP BY bkey, bstart
  ),
  cred_ger AS (
    SELECT bkey, COALESCE(SUM(v_sess), 0) AS v
    FROM (
      SELECT sb.bkey, GREATEST(SUM(l.valor), 0) AS v_sess
        FROM public.cliente_creditos_ledger l
        JOIN sess_bucketed sb
          ON sb.session_id = l.session_id_origem
          OR sb.id::text   = l.session_id_origem
       WHERE l.user_id = p_user_id
         AND l.origem IN ('overpay', 'reducao_escopo', 'reversao_grant', 'reconcile_sobra', 'estorno_para_credito')
       GROUP BY sb.bkey, sb.id
    ) sub
    GROUP BY bkey
  ),
  cred_uso AS (
    SELECT bkey, COALESCE(SUM(v_sess), 0) AS v
    FROM (
      SELECT sb.bkey, GREATEST(SUM(-l.valor), 0) AS v_sess
        FROM public.cliente_creditos_ledger l
        JOIN sess_bucketed sb
          ON sb.session_id = l.session_id_consumo
          OR sb.id::text   = l.session_id_consumo
       WHERE l.user_id = p_user_id
         AND l.origem IN ('consumo_desconto', 'reversao_consumo')
       GROUP BY sb.bkey, sb.id
    ) sub
    GROUP BY bkey
  ),
  caixa_tx AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(t.data_transacao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', t.data_transacao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', t.data_transacao), 'YYYY') || '-Q' || extract(quarter FROM t.data_transacao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', t.data_transacao), 'YYYY')
      END AS bkey,
      CASE
        WHEN t.tipo = 'pagamento' THEN t.valor
        WHEN t.tipo = 'estorno'   THEN -t.valor
        ELSE 0
      END AS v
    FROM public.clientes_transacoes t
    LEFT JOIN public.cobrancas c ON t.cobranca_id = c.id
    WHERE t.user_id = p_user_id
      AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
      AND (c.provedor IS DISTINCT FROM 'asaas' OR c.id IS NULL)
      AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
      AND t.data_transacao BETWEEN p_start AND p_end
  ),
  caixa_gw AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(gm.movement_date::date, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', gm.movement_date::date), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', gm.movement_date::date), 'YYYY') || '-Q' || extract(quarter FROM gm.movement_date::date)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', gm.movement_date::date), 'YYYY')
      END AS bkey,
      gm.amount AS v
    FROM public.gateway_cash_movements gm
    JOIN public.cobrancas c ON c.id = gm.cobranca_id
    WHERE c.user_id = p_user_id
      AND gm.movement_date::date BETWEEN p_start AND p_end
  ),
  caixa_combined AS (
    SELECT bkey, v FROM caixa_tx
    UNION ALL
    SELECT bkey, v FROM caixa_gw
  ),
  caixa AS (
    SELECT bkey, COALESCE(SUM(v), 0) AS v
    FROM caixa_combined
    GROUP BY bkey
  ),
  all_keys AS (
    SELECT bkey, bstart FROM sess_agg
    UNION
    SELECT bkey,
      CASE
        WHEN v_gran = 'total' THEN p_start
        WHEN v_gran = 'day'   THEN to_date(bkey, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_date(bkey || '-01', 'YYYY-MM-DD')
        WHEN v_gran = 'quarter' THEN to_date(split_part(bkey, '-Q', 1) || '-' || (split_part(bkey, '-Q', 2)::int * 3 - 2)::text || '-01', 'YYYY-MM-DD')
        WHEN v_gran = 'year'  THEN to_date(bkey || '-01-01', 'YYYY-MM-DD')
      END AS bstart
    FROM caixa
  )
  SELECT
    k.bkey,
    k.bstart,
    COALESCE(sa.previsto, 0)           AS previsto,
    COALESCE(sa.receita, 0)            AS receita,
    COALESCE(sa.pendente, 0)           AS pendente,
    COALESCE(sa.sessoes, 0)::int       AS sessoes,
    COALESCE(cg.v, 0)                  AS creditos_gerados,
    COALESCE(cu.v, 0)                  AS creditos_utilizados,
    COALESCE(cx.v, 0)                  AS caixa_recebido
  FROM all_keys k
  LEFT JOIN sess_agg sa ON sa.bkey = k.bkey
  LEFT JOIN cred_ger cg ON cg.bkey = k.bkey
  LEFT JOIN cred_uso cu ON cu.bkey = k.bkey
  LEFT JOIN caixa    cx ON cx.bkey = k.bkey
  ORDER BY k.bstart;
END;
$function$;

-- 4. Atualização de workflow_session_financials
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
  v_extras_pago_componentes numeric := 0;
  v_extras_pago_manual_fotos numeric := 0;
  v_manual_combinado numeric := 0;
  v_sessao_tag     numeric := 0;
  v_pagamentos_genericos numeric := 0;
  v_pago_direto_extras numeric := 0;
  v_combinado_para_extras numeric := 0;
  v_sessao_tag_para_extras numeric := 0;
  v_generico_para_extras numeric := 0;
  v_sessao_liq numeric := 0;
  v_cred_ger       numeric := 0;
  v_cred_util      numeric := 0;
  v_excedente      numeric := 0;
  v_extras_liq     numeric := 0;
  v_pre_selecao    boolean := false;
  v_resolved_gal_id uuid;
  v_override       boolean := false;
  v_mode           text;
  v_gal_res_qtd    integer := 0;
BEGIN
  SELECT s.id, s.user_id, s.session_id AS session_slug,
         s.valor_base_pacote, s.valor_foto_extra,
         s.valor_total_foto_extra, s.qtd_fotos_extra, s.valor_adicional,
         s.desconto, s.produtos_incluidos, s.valor_pago,
         s.galeria_id, s.regras_congeladas, s.extras_overridden
    INTO v_s
    FROM public.clientes_sessoes s
   WHERE s.id = p_session_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_override := COALESCE(v_s.extras_overridden, false);

  IF v_s.galeria_id IS NULL AND v_s.session_slug IS NOT NULL THEN
    SELECT g.id, COALESCE(g.total_fotos_extras_vendidas, 0)
      INTO v_resolved_gal_id, v_gal_res_qtd
      FROM public.galerias g
     WHERE g.user_id    = v_s.user_id
       AND g.session_id = v_s.session_slug
     ORDER BY g.finalized_at DESC NULLS LAST, g.created_at DESC
     LIMIT 1;

    IF v_resolved_gal_id IS NOT NULL
       AND NOT v_override
       AND (
         COALESCE(v_s.qtd_fotos_extra, 0) = 0
         OR COALESCE(v_s.qtd_fotos_extra, 0) = v_gal_res_qtd
       )
    THEN
      v_s.galeria_id := v_resolved_gal_id;
    END IF;
  END IF;

  IF v_s.galeria_id IS NOT NULL AND NOT v_override THEN
    v_mode := 'gallery';
  ELSIF v_override THEN
    v_mode := 'override';
  ELSIF COALESCE(v_s.qtd_fotos_extra, 0) > 0 THEN
    v_mode := 'manual';
  ELSE
    v_mode := 'empty';
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

  IF v_mode = 'gallery' THEN
    SELECT g.total_fotos_extras_vendidas, g.valor_foto_extra, g.regras_congeladas,
           g.status, g.fotos_selecionadas, g.fotos_incluidas
      INTO v_gal
      FROM public.galerias g
     WHERE g.id = v_s.galeria_id;

    v_gal_qtd := COALESCE(v_gal.total_fotos_extras_vendidas, 0);

    IF v_gal.status = 'selecao_completa' THEN
      v_gal_qtd := GREATEST(
        v_gal_qtd,
        COALESCE(v_gal.fotos_selecionadas, 0) - COALESCE(v_gal.fotos_incluidas, 0)
      );
    END IF;

    v_qtd        := COALESCE(NULLIF(v_gal_qtd, 0), COALESCE(v_s.qtd_fotos_extra, 0));
    v_unit_bruto := COALESCE(NULLIF(v_gal.valor_foto_extra, 0), COALESCE(v_s.valor_foto_extra, 0));
    v_regras     := COALESCE(v_gal.regras_congeladas, v_s.regras_congeladas);

    IF v_gal.status IS NOT NULL AND v_gal.status NOT IN ('selecao_completa','entregue','concluida','concluída') THEN
      v_pre_selecao := true;
    END IF;

    IF v_gal_qtd = 0 AND v_pre_selecao THEN
      v_qtd := 0;
    END IF;

    IF v_qtd = 0 THEN
      SELECT g.valor_foto_extra, g.regras_congeladas
        INTO v_gal
        FROM public.galerias g WHERE g.id = v_s.galeria_id;
    END IF;

  ELSIF v_mode IN ('manual', 'override') THEN
    v_qtd        := COALESCE(v_s.qtd_fotos_extra, 0);
    v_unit_bruto := COALESCE(v_s.valor_foto_extra, 0);
    v_regras     := v_s.regras_congeladas;
    v_gal_qtd    := 0;

  ELSE
    v_qtd        := 0;
    v_unit_bruto := COALESCE(v_s.valor_foto_extra, 0);
    v_regras     := v_s.regras_congeladas;
    v_gal_qtd    := 0;
  END IF;

  v_extras_bruto := ROUND((v_qtd * v_unit_bruto)::numeric, 2);

  IF v_mode IN ('override', 'manual') THEN
    v_unit_c_desc   := v_unit_bruto;
    v_extras_c_desc := v_extras_bruto;
  ELSE
    v_unit_c_desc := public._extra_unit_price_for_quantity(v_regras, v_unit_bruto, v_qtd);
    IF v_unit_c_desc IS NULL OR v_unit_c_desc = 0 THEN
      v_unit_c_desc := v_unit_bruto;
    END IF;
    v_unit_c_desc   := LEAST(v_unit_c_desc, v_unit_bruto);
    v_extras_c_desc := ROUND((v_qtd * v_unit_c_desc)::numeric, 2);
  END IF;

  v_base      := COALESCE(v_s.valor_base_pacote, 0);
  v_desconto  := COALESCE(v_s.desconto, 0);
  v_adicional := COALESCE(v_s.valor_adicional, 0);

  v_total := GREATEST(0, v_base + v_extras_c_desc + v_produtos + v_adicional - v_desconto);
  v_pago  := COALESCE(v_s.valor_pago, 0);

  v_excedente  := GREATEST(0, v_desconto - (v_base + v_adicional + v_produtos));
  v_excedente  := LEAST(v_excedente, v_extras_c_desc);
  v_extras_liq := GREATEST(0, v_extras_c_desc - v_excedente);
  v_sessao_liq := GREATEST(0, v_total - v_extras_liq);

  session_id                := v_s.id;
  valor_base_pacote         := v_base;
  valor_produtos            := v_produtos;
  valor_extras_bruto        := v_extras_bruto;
  valor_extras_com_desconto := v_extras_c_desc;
  desconto_progressivo      := GREATEST(0, v_extras_bruto - v_extras_c_desc);
  desconto_manual           := v_desconto;
  valor_adicional           := v_adicional;
  valor_total               := v_total;
  valor_pago                := LEAST(v_pago, v_total);
  valor_pendente            := GREATEST(0, v_total - v_pago);
  qtd_fotos_extra           := v_qtd;
  qtd_extras_galeria        := v_gal_qtd;

  v_sess_text := v_s.id::text;

  SELECT
    GREATEST(COALESCE(SUM(CASE WHEN l.origem IN ('overpay', 'reducao_escopo', 'reversao_grant', 'reconcile_sobra', 'estorno_para_credito') 
                                 AND (l.session_id_origem = v_sess_text OR (v_s.session_slug IS NOT NULL AND l.session_id_origem = v_s.session_slug))
                                THEN l.valor ELSE 0 END), 0), 0),
    GREATEST(COALESCE(SUM(CASE WHEN l.origem IN ('consumo_desconto', 'reversao_consumo')
                                 AND (l.session_id_consumo = v_sess_text OR (v_s.session_slug IS NOT NULL AND l.session_id_consumo = v_s.session_slug))
                                THEN -l.valor ELSE 0 END), 0), 0)
    INTO v_cred_ger, v_cred_util
  FROM public.cliente_creditos_ledger l
  WHERE l.user_id = v_s.user_id
    AND (
      l.session_id_origem = v_sess_text
      OR l.session_id_consumo = v_sess_text
      OR (v_s.session_slug IS NOT NULL AND l.session_id_origem = v_s.session_slug)
      OR (v_s.session_slug IS NOT NULL AND l.session_id_consumo = v_s.session_slug)
    );

  credito_gerado    := v_cred_ger;
  credito_utilizado := v_cred_util;
  credito_liquido   := v_cred_ger - v_cred_util;

  IF v_pre_selecao THEN
    v_extras_pago := 0;
  ELSE
    DECLARE
      v_pago_transacoes NUMERIC;
      v_pago_parcelas NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(
        CASE
          WHEN c.finalidade = 'fotos_extras' THEN t.valor
          WHEN c.finalidade = 'sessao_e_extras'
               AND COALESCE(c.valor_sessao_componente, 0) + COALESCE(c.valor_extras_componente, 0) > 0
            THEN t.valor
                 * (COALESCE(c.valor_extras_componente, 0)
                    / (COALESCE(c.valor_sessao_componente, 0) + COALESCE(c.valor_extras_componente, 0)))
          ELSE 0
        END
      ), 0)
        INTO v_pago_transacoes
        FROM public.clientes_transacoes t
        LEFT JOIN public.cobrancas c ON c.id = t.cobranca_id
       WHERE t.user_id = v_s.user_id
         AND t.tipo = 'pagamento'
         AND c.id IS NOT NULL
         AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
         AND (
           t.session_id = v_sess_text
           OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
           OR c.galeria_id IN (SELECT g.id FROM public.galerias g WHERE g.session_id = v_s.session_slug OR g.session_id = v_sess_text)
         );

      SELECT COALESCE(SUM(
        CASE
          WHEN c.finalidade = 'fotos_extras' THEN COALESCE(p.valor_principal, p.valor_bruto)
          WHEN c.finalidade = 'sessao_e_extras'
               AND COALESCE(c.valor_sessao_componente, 0) + COALESCE(c.valor_extras_componente, 0) > 0
            THEN COALESCE(p.valor_principal, p.valor_bruto)
                 * (COALESCE(c.valor_extras_componente, 0)
                    / (COALESCE(c.valor_sessao_componente, 0) + COALESCE(c.valor_extras_componente, 0)))
          ELSE 0
        END
      ), 0)
        INTO v_pago_parcelas
        FROM public.cobranca_parcelas p
        INNER JOIN public.cobrancas c ON c.id = p.cobranca_id
       WHERE c.user_id = v_s.user_id
         AND c.provedor = 'asaas' 
         AND p.status IN ('confirmado', 'recebido', 'antecipado')
         AND (
           c.session_id = v_sess_text
           OR (v_s.session_slug IS NOT NULL AND c.session_id = v_s.session_slug)
           OR c.galeria_id IN (SELECT g.id FROM public.galerias g WHERE g.session_id = v_s.session_slug OR g.session_id = v_sess_text)
         );

      v_extras_pago_componentes := v_pago_transacoes + v_pago_parcelas;
    END;

    SELECT COALESCE(SUM(t.valor), 0)
      INTO v_extras_pago_manual_fotos
      FROM public.clientes_transacoes t
     WHERE t.user_id = v_s.user_id
       AND t.tipo = 'pagamento'
       AND t.cobranca_id IS NULL
       AND (
         t.session_id = v_sess_text
         OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
       )
       AND t.descricao ILIKE '%:fotos_extras]%';

    SELECT COALESCE(SUM(t.valor), 0)
      INTO v_manual_combinado
      FROM public.clientes_transacoes t
     WHERE t.user_id = v_s.user_id
       AND t.tipo = 'pagamento'
       AND t.cobranca_id IS NULL
       AND (
         t.session_id = v_sess_text
         OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
       )
       AND t.descricao ILIKE '%:sessao_e_extras]%';

    SELECT COALESCE(SUM(t.valor), 0)
      INTO v_sessao_tag
      FROM public.clientes_transacoes t
     WHERE t.user_id = v_s.user_id
       AND t.tipo = 'pagamento'
       AND t.cobranca_id IS NULL
       AND (
         t.session_id = v_sess_text
         OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
       )
       AND t.descricao ILIKE '%:sessao]%';

    SELECT COALESCE(SUM(t.valor), 0)
      INTO v_pagamentos_genericos
      FROM public.clientes_transacoes t
     WHERE t.user_id = v_s.user_id
       AND t.tipo = 'pagamento'
       AND t.cobranca_id IS NULL
       AND (
         t.session_id = v_sess_text
         OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
       )
       AND t.descricao NOT ILIKE '%:fotos_extras]%'
       AND t.descricao NOT ILIKE '%:sessao_e_extras]%'
       AND t.descricao NOT ILIKE '%:sessao]%';

    v_pago_direto_extras := v_extras_pago_componentes + v_extras_pago_manual_fotos;

    IF v_total > 0 AND v_extras_liq > 0 THEN
      v_combinado_para_extras := v_manual_combinado * (v_extras_liq / v_total);
    ELSE
      v_combinado_para_extras := 0;
    END IF;

    DECLARE
      v_pago_nao_waterfall numeric := v_pago - v_sessao_tag - v_pagamentos_genericos;
      v_sessao_pendente_apos_diretos numeric;
      v_sessao_pendente_apos_sessao_tag numeric;
    BEGIN
      IF v_pago_nao_waterfall < 0 THEN v_pago_nao_waterfall := 0; END IF;

      v_sessao_pendente_apos_diretos := GREATEST(
        0,
        v_sessao_liq - GREATEST(0, v_pago_nao_waterfall
                                    - v_pago_direto_extras
                                    - v_combinado_para_extras)
      );

      v_sessao_tag_para_extras := GREATEST(0, v_sessao_tag - v_sessao_pendente_apos_diretos);
      v_sessao_pendente_apos_sessao_tag := GREATEST(0, v_sessao_pendente_apos_diretos - v_sessao_tag);

      v_generico_para_extras := GREATEST(0, v_pagamentos_genericos - v_sessao_pendente_apos_sessao_tag);
    END;

    v_extras_pago := v_pago_direto_extras
                   + v_combinado_para_extras
                   + v_sessao_tag_para_extras
                   + v_generico_para_extras;

    v_extras_pago := LEAST(v_extras_liq, GREATEST(0, v_extras_pago));
  END IF;

  extras_pago              := ROUND(v_extras_pago::numeric, 2);
  extras_liquido           := ROUND(v_extras_liq::numeric, 2);
  desconto_aplicado_extras := ROUND(v_excedente::numeric, 2);
  extras_pendente          := GREATEST(0, ROUND((v_extras_liq - v_extras_pago)::numeric, 2));

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_month_metrics(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workflow_range_metrics(uuid, date, date, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workflow_session_financials(uuid) TO authenticated, service_role;
