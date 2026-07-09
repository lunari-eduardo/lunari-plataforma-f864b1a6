
-- 1) workflow_session_financials com gate pré-seleção
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
    SELECT g.total_fotos_extras_vendidas, g.valor_foto_extra, g.regras_congeladas, g.status
      INTO v_gal
      FROM public.galerias g
     WHERE g.id = v_s.galeria_id;

    v_gal_qtd    := COALESCE(v_gal.total_fotos_extras_vendidas, 0);
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

    -- Gate pré-seleção: só considera cobrança paga como "quebra" do gate.
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

  v_unit_c_desc := public._extra_unit_price_for_quantity(v_regras, v_unit_bruto, v_qtd);
  IF v_unit_c_desc IS NULL OR v_unit_c_desc = 0 THEN
    v_unit_c_desc := v_unit_bruto;
  END IF;
  v_unit_c_desc   := LEAST(v_unit_c_desc, v_unit_bruto);
  v_extras_c_desc := ROUND((v_qtd * v_unit_c_desc)::numeric, 2);

  v_base      := COALESCE(v_s.valor_base_pacote, 0);
  v_desconto  := COALESCE(v_s.desconto, 0);
  v_adicional := COALESCE(v_s.valor_adicional, 0);

  v_total := GREATEST(0, v_base + v_extras_c_desc + v_produtos + v_adicional - v_desconto);
  v_pago  := COALESCE(v_s.valor_pago, 0);

  v_excedente  := GREATEST(0, v_desconto - (v_base + v_adicional + v_produtos));
  v_excedente  := LEAST(v_excedente, v_extras_c_desc);
  v_extras_liq := GREATEST(0, v_extras_c_desc - v_excedente);

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
      INTO v_extras_pago
      FROM public.clientes_transacoes t
      LEFT JOIN public.cobrancas c ON c.id = t.cobranca_id
     WHERE t.user_id = v_s.user_id
       AND t.tipo = 'pagamento'
       AND (
         t.session_id = v_sess_text
         OR (v_s.session_slug IS NOT NULL AND t.session_id = v_s.session_slug)
         OR (v_s.galeria_id IS NOT NULL AND c.galeria_id = v_s.galeria_id)
       );
  END IF;

  extras_pago              := ROUND(v_extras_pago::numeric, 2);
  extras_liquido           := ROUND(v_extras_liq::numeric, 2);
  desconto_aplicado_extras := ROUND(v_excedente::numeric, 2);
  extras_pendente          := GREATEST(0, ROUND((v_extras_liq - v_extras_pago)::numeric, 2));

  RETURN NEXT;
END;
$function$;

-- 2) calculate_gallery_extra_payment com mesmo gate pré-seleção
CREATE OR REPLACE FUNCTION public.calculate_gallery_extra_payment(p_gallery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_g RECORD;
  v_regras jsonb;
  v_rules_source text := 'gallery_fixed';
  v_sess RECORD;
  v_selected int := 0;
  v_included int := 0;
  v_charge_type text := 'only_extras';
  v_extras_necess int := 0;
  v_extras_pagas int := 0;
  v_extras_a_cobrar int := 0;
  v_valor_pago numeric := 0;
  v_unit numeric := 0;
  v_ideal numeric := 0;
  v_a_cobrar numeric := 0;
  v_is_fully_paid boolean := false;
  v_sess_base numeric := 0;
  v_sess_adic numeric := 0;
  v_sess_desc numeric := 0;
  v_sess_prod numeric := 0;
  v_excedente numeric := 0;
  v_ideal_liq numeric := 0;
  v_has_paid boolean := false;
  v_pre_selecao boolean := false;
BEGIN
  SELECT id, user_id, fotos_incluidas, fotos_selecionadas,
         valor_foto_extra, regras_congeladas, session_id,
         total_fotos_extras_vendidas, valor_total_vendido,
         venda_tipo_cobranca, configuracoes, status
  INTO v_g FROM galerias WHERE id = p_gallery_id;
  IF v_g IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  -- Gate pré-seleção: se galeria ainda não finalizou seleção e não tem cobrança paga,
  -- não retornar extras a cobrar.
  IF v_g.status IN ('rascunho','enviado','selecao_iniciada') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cobrancas c
       WHERE c.galeria_id = p_gallery_id
         AND c.finalidade IN ('fotos_extras','sessao_e_extras')
         AND c.status IN ('pago','pago_manual')
    ) INTO v_has_paid;
    IF NOT v_has_paid THEN
      v_pre_selecao := true;
    END IF;
  END IF;

  IF v_pre_selecao THEN
    RETURN jsonb_build_object(
      'success', true,
      'gallery_id', p_gallery_id,
      'user_id', v_g.user_id,
      'session_id', v_g.session_id,
      'charge_type', 'only_extras',
      'selected_count', COALESCE(v_g.fotos_selecionadas, 0),
      'included_count', COALESCE(v_g.fotos_incluidas, 0),
      'extras_necessarias', 0,
      'extras_pagas', 0,
      'extras_a_cobrar', 0,
      'valor_pago', 0,
      'valor_unitario', COALESCE(v_g.valor_foto_extra, 0),
      'valor_total_ideal', 0,
      'valor_total_ideal_bruto', 0,
      'valor_a_cobrar', 0,
      'is_fully_paid', true,
      'rules_source', 'pre_selecao_gate',
      'desconto_sessao_excedente', 0,
      'pre_selecao', true
    );
  END IF;

  v_selected := COALESCE(v_g.fotos_selecionadas, 0);
  v_included := COALESCE(v_g.fotos_incluidas, 0);

  v_charge_type := COALESCE(
    v_g.venda_tipo_cobranca,
    NULLIF(v_g.configuracoes->'saleSettings'->>'chargeType', ''),
    'only_extras'
  );
  IF v_charge_type NOT IN ('all_selected','only_extras') THEN
    v_charge_type := 'only_extras';
  END IF;

  IF v_charge_type = 'all_selected' THEN
    v_extras_necess := v_selected;
  ELSE
    v_extras_necess := GREATEST(0, v_selected - v_included);
  END IF;

  v_regras := v_g.regras_congeladas;
  IF v_regras IS NOT NULL THEN
    v_rules_source := 'gallery_frozen';
  ELSIF v_g.session_id IS NOT NULL THEN
    SELECT regras_congeladas INTO v_sess FROM clientes_sessoes
     WHERE session_id = v_g.session_id LIMIT 1;
    IF v_sess.regras_congeladas IS NOT NULL THEN
      v_regras := v_sess.regras_congeladas;
      v_rules_source := 'session_frozen';
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(
      CASE finalidade
        WHEN 'fotos_extras'    THEN valor
        WHEN 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
        ELSE 0
      END
    ), 0)::numeric,
    COALESCE(SUM(COALESCE(NULLIF(qtd_fotos, 0), 0)), 0)::int
    INTO v_valor_pago, v_extras_pagas
   FROM cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade IN ('fotos_extras','sessao_e_extras')
     AND status IN ('pago', 'pago_manual');

  v_extras_a_cobrar := GREATEST(0, v_extras_necess - v_extras_pagas);

  v_unit  := public._extra_unit_price_for_quantity(v_regras, v_g.valor_foto_extra, v_extras_necess);
  v_ideal := ROUND((v_extras_necess * v_unit)::numeric, 2);

  IF v_g.session_id IS NOT NULL THEN
    SELECT s.valor_base_pacote, s.valor_adicional, s.desconto, s.produtos_incluidos
      INTO v_sess
      FROM clientes_sessoes s
     WHERE s.session_id = v_g.session_id
     LIMIT 1;

    v_sess_base := COALESCE(v_sess.valor_base_pacote, 0);
    v_sess_adic := COALESCE(v_sess.valor_adicional, 0);
    v_sess_desc := COALESCE(v_sess.desconto, 0);

    IF v_sess.produtos_incluidos IS NOT NULL
       AND jsonb_typeof(v_sess.produtos_incluidos) = 'array' THEN
      SELECT COALESCE(SUM(
               CASE WHEN p->>'tipo' = 'manual'
                    THEN COALESCE((p->>'quantidade')::numeric,0)
                         * COALESCE((p->>'valorUnitario')::numeric,0)
                    ELSE 0 END
             ), 0)
        INTO v_sess_prod
        FROM jsonb_array_elements(v_sess.produtos_incluidos) p;
    END IF;

    v_excedente := GREATEST(0, v_sess_desc - (v_sess_base + v_sess_adic + v_sess_prod));
    v_excedente := LEAST(v_excedente, v_ideal);
  END IF;

  v_ideal_liq := GREATEST(0, ROUND((v_ideal - v_excedente)::numeric, 2));
  v_a_cobrar  := GREATEST(0, ROUND((v_ideal_liq - v_valor_pago)::numeric, 2));

  v_is_fully_paid := (v_a_cobrar <= 0);

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', p_gallery_id,
    'user_id', v_g.user_id,
    'session_id', v_g.session_id,
    'charge_type', v_charge_type,
    'selected_count', v_selected,
    'included_count', v_included,
    'extras_necessarias', v_extras_necess,
    'extras_pagas', v_extras_pagas,
    'extras_a_cobrar', v_extras_a_cobrar,
    'valor_pago', v_valor_pago,
    'valor_unitario', v_unit,
    'valor_total_ideal', v_ideal_liq,
    'valor_total_ideal_bruto', v_ideal,
    'valor_a_cobrar', v_a_cobrar,
    'is_fully_paid', v_is_fully_paid,
    'rules_source', v_rules_source,
    'desconto_sessao_excedente', v_excedente,
    'pre_selecao', false
  );
END;
$function$;

-- 3) sync_gallery_extras_to_session respeita extras_overridden
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
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

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

    -- Só sobrescreve sessões que NÃO estão marcadas como override manual.
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

  IF v_fotos_incluidas_mudou THEN
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'fotosIncluidas')::int, -1) IS DISTINCT FROM COALESCE(NEW.fotos_incluidas, 0)
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            COALESCE(g.regras_congeladas, '{}'::jsonb),
            '{pacote,fotosIncluidas}',
            to_jsonb(COALESCE(NEW.fotos_incluidas, 0)),
            true
          )
      WHERE g.id = NEW.id;
    END IF;

    UPDATE public.clientes_sessoes s
    SET
      regras_congeladas = jsonb_set(
        COALESCE(s.regras_congeladas, '{}'::jsonb),
        '{pacote,fotosIncluidas}',
        to_jsonb(COALESCE(NEW.fotos_incluidas, 0)),
        true
      ),
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND (
        s.regras_congeladas IS NULL
        OR jsonb_typeof(s.regras_congeladas->'pacote') <> 'object'
        OR COALESCE((s.regras_congeladas->'pacote'->>'fotosIncluidas')::int, -1) IS DISTINCT FROM COALESCE(NEW.fotos_incluidas, 0)
      );
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Backfill cirúrgico: sessões sem galeria e sem override manual → zera extras
UPDATE public.clientes_sessoes
   SET qtd_fotos_extra = 0,
       valor_total_foto_extra = 0,
       updated_at = now()
 WHERE galeria_id IS NULL
   AND COALESCE(extras_overridden, false) = false
   AND (COALESCE(qtd_fotos_extra, 0) > 0 OR COALESCE(valor_total_foto_extra, 0) > 0);
