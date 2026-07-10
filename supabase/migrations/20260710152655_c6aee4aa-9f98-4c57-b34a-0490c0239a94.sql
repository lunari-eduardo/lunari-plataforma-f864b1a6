
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
  v_desc_absorvido numeric := 0;
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

  v_extras_bruto := ROUND((v_qtd * v_unit_bruto)::numeric, 2);

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

  v_desc_absorvido := LEAST(v_desconto, v_base + v_adicional + v_produtos);
  v_excedente := GREATEST(0, v_desconto - v_desc_absorvido);
  v_excedente := LEAST(v_excedente, v_extras_c_desc);
  v_extras_liq := GREATEST(0, v_extras_c_desc - v_excedente);

  v_total := ROUND((v_base + v_produtos + v_extras_liq + v_adicional - v_desc_absorvido)::numeric, 2);
  v_pago  := COALESCE(v_s.valor_pago, 0);

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
