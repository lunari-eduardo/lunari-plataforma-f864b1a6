-- ==============================================================================
-- Migration: 20260901000000_liquidation_dates_and_gateway_sync.sql
-- Fase 1: Atualização de RPC workflow_session_financials e data_credito
-- ==============================================================================

-- 1. Adicionar data_credito e data_credito_real nas cobrancas
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS data_credito DATE;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS data_credito_real TIMESTAMPTZ;

-- 2. Corrigir join de galeria_id em workflow_session_financials
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
    v_unit_bruto := COALESCE(v_gal.valor_foto_extra, COALESCE(v_s.valor_foto_extra, 0));
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
    COALESCE(SUM(CASE WHEN l.valor > 0 THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.valor < 0 THEN -l.valor ELSE 0 END), 0)
    INTO v_cred_ger, v_cred_util
  FROM public.cliente_creditos_ledger l
  WHERE l.user_id = v_s.user_id
    AND (
      l.session_id_origem  = v_sess_text
      OR l.session_id_consumo = v_sess_text
      OR (v_s.session_slug IS NOT NULL AND l.session_id_origem  = v_s.session_slug)
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
         -- Fase 4: Não somar transações antigas migradas se as parcelas já vão somar
         AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
         AND (
           t.session_id = v_sess_text
           OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
           OR c.galeria_id IN (SELECT id FROM public.galerias WHERE session_id = v_s.session_slug OR session_id = v_sess_text)
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
           OR c.galeria_id IN (SELECT id FROM public.galerias WHERE session_id = v_s.session_slug OR session_id = v_sess_text)
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
