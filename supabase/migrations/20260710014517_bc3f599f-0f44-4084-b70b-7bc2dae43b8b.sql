
-- =========================================================================
-- 1) RPC workflow_session_financials: reconhecer selecao_completa sem venda
-- =========================================================================
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

    v_gal_qtd    := COALESCE(v_gal.total_fotos_extras_vendidas, 0);

    -- NOVO: quando a galeria já está com seleção finalizada mas ainda não há
    -- venda registrada, usar (fotos_selecionadas − fotos_incluidas) como fonte.
    IF v_gal.status = 'selecao_completa'
       AND COALESCE(v_gal.total_fotos_extras_vendidas, 0) = 0 THEN
      v_gal_qtd := GREATEST(0,
        COALESCE(v_gal.fotos_selecionadas, 0)
        - COALESCE(v_gal.fotos_incluidas, 0)
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

GRANT EXECUTE ON FUNCTION public.workflow_session_financials(uuid) TO authenticated, service_role;

-- =========================================================================
-- 2) Trigger passa a reagir também a status e fotos_selecionadas/incluidas
-- =========================================================================
DROP TRIGGER IF EXISTS trigger_sync_gallery_extras_to_session ON public.galerias;
CREATE TRIGGER trigger_sync_gallery_extras_to_session
  AFTER UPDATE OF
    valor_foto_extra, total_fotos_extras_vendidas, valor_total_vendido,
    status, fotos_selecionadas, fotos_incluidas
  ON public.galerias
  FOR EACH ROW EXECUTE FUNCTION public.sync_gallery_extras_to_session();

-- =========================================================================
-- 3) Backfill: sessões vinculadas a galerias já em selecao_completa sem venda
--    (sem override manual e ainda com qtd_fotos_extra = 0)
-- =========================================================================
UPDATE public.clientes_sessoes s
   SET qtd_fotos_extra = GREATEST(0, g.fotos_selecionadas - g.fotos_incluidas),
       valor_total_foto_extra = ROUND(
         GREATEST(0, g.fotos_selecionadas - g.fotos_incluidas)
         * COALESCE(NULLIF(s.valor_foto_extra, 0), g.valor_foto_extra, 0)
       , 2),
       updated_at = now()
  FROM public.galerias g
 WHERE s.galeria_id = g.id
   AND g.status = 'selecao_completa'
   AND COALESCE(g.total_fotos_extras_vendidas, 0) = 0
   AND COALESCE(s.extras_overridden, false) = false
   AND COALESCE(s.qtd_fotos_extra, 0) = 0
   AND GREATEST(0, COALESCE(g.fotos_selecionadas,0) - COALESCE(g.fotos_incluidas,0)) > 0;
