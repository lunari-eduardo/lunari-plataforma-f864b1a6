
-- =========================================================================
-- FASE 1: Correção da automação Galeria → Workflow → Financeiro
-- =========================================================================

-- 1) Belt-and-suspenders: toda cobrança com galeria_id vira 'fotos_extras'
--    automaticamente, mesmo se o caller esquecer.
CREATE OR REPLACE FUNCTION public.default_finalidade_from_galeria()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.galeria_id IS NOT NULL AND (NEW.finalidade IS NULL OR NEW.finalidade = 'sessao') THEN
    NEW.finalidade := 'fotos_extras';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_finalidade_from_galeria ON public.cobrancas;
CREATE TRIGGER trg_default_finalidade_from_galeria
  BEFORE INSERT ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.default_finalidade_from_galeria();

-- 2) Backfill: cobranças legadas com galeria_id sem finalidade correta.
UPDATE public.cobrancas
   SET finalidade = 'fotos_extras'
 WHERE galeria_id IS NOT NULL
   AND (finalidade IS NULL OR finalidade = 'sessao');

-- 3) Re-disparar finalize para as pagas que ficaram órfãs.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.cobrancas
     WHERE finalidade = 'fotos_extras'
       AND galeria_id IS NOT NULL
       AND status IN ('pago','pago_manual')
       AND (extras_contabilizados IS NOT TRUE OR extras_contabilizados IS NULL)
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill finalize falhou % : %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4) RPC endurecida: extras_pago também casa por galeria_id da sessão,
--    não só session_id — fecha o buraco quando transação nasce só com
--    vínculo de galeria.
DROP FUNCTION IF EXISTS public.workflow_session_financials(uuid);
CREATE OR REPLACE FUNCTION public.workflow_session_financials(p_session_id uuid)
RETURNS TABLE (
  session_id                 uuid,
  valor_base_pacote          numeric,
  valor_produtos             numeric,
  valor_extras_bruto         numeric,
  valor_extras_com_desconto  numeric,
  desconto_progressivo       numeric,
  desconto_manual            numeric,
  valor_adicional            numeric,
  valor_total                numeric,
  valor_pago                 numeric,
  valor_pendente             numeric,
  qtd_fotos_extra            integer,
  qtd_extras_galeria         integer,
  credito_gerado             numeric,
  credito_utilizado          numeric,
  credito_liquido            numeric,
  extras_pago                numeric,
  extras_pendente            numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    SELECT g.total_fotos_extras_vendidas, g.valor_foto_extra, g.regras_congeladas
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

  -- extras_pago: casa por (a) session_id texto/UUID OU (b) galeria_id direto,
  -- respeitando finalidade da cobrança.
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

  extras_pago     := ROUND(v_extras_pago::numeric, 2);
  extras_pendente := GREATEST(0, ROUND((v_extras_c_desc - v_extras_pago)::numeric, 2));

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_session_financials(uuid) TO authenticated, service_role;

-- 5) `_extra_unit_price_for_quantity`: quando modelo='fixo' e snapshot diverge
--    do preço atual da sessão, a sessão VENCE (Opção A da constituição).
CREATE OR REPLACE FUNCTION public._extra_unit_price_for_quantity(
  p_regras_congeladas jsonb, p_valor_fixo numeric, p_total_extras integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_modelo text;
  v_pacote_unit numeric;
  v_unit numeric;
  v_faixas jsonb;
  v_faixa jsonb;
  v_min int;
  v_max int;
BEGIN
  IF p_total_extras IS NULL OR p_total_extras <= 0 THEN
    RETURN 0;
  END IF;

  -- Sessão vence: se p_valor_fixo (da sessão) existir, é o preço-teto do modelo fixo.
  v_pacote_unit := COALESCE(
    NULLIF(p_valor_fixo, 0),
    NULLIF((p_regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    0
  );

  IF p_regras_congeladas IS NULL THEN
    RETURN COALESCE(NULLIF(p_valor_fixo, 0), 0);
  END IF;

  v_modelo := COALESCE(p_regras_congeladas->'precificacaoFotoExtra'->>'modelo', p_regras_congeladas->>'modelo', 'fixo');

  IF v_modelo = 'fixo' THEN
    -- Preferir sempre o preço da sessão (p_valor_fixo) sobre o snapshot.
    RETURN COALESCE(
      NULLIF(p_valor_fixo, 0),
      NULLIF((p_regras_congeladas->'precificacaoFotoExtra'->>'valorFixo')::numeric, 0),
      v_pacote_unit
    );
  END IF;

  IF v_modelo = 'categoria' THEN
    IF COALESCE((p_regras_congeladas->'precificacaoFotoExtra'->'tabelaCategoria'->>'usar_valor_fixo_pacote')::boolean, false) THEN
      RETURN v_pacote_unit;
    END IF;
    v_faixas := p_regras_congeladas->'precificacaoFotoExtra'->'tabelaCategoria'->'faixas';
  ELSE
    v_faixas := p_regras_congeladas->'precificacaoFotoExtra'->'tabelaGlobal'->'faixas';
  END IF;

  IF v_faixas IS NULL OR jsonb_typeof(v_faixas) <> 'array' OR jsonb_array_length(v_faixas) = 0 THEN
    RETURN v_pacote_unit;
  END IF;

  FOR v_faixa IN SELECT * FROM jsonb_array_elements(v_faixas) LOOP
    v_min := COALESCE((v_faixa->>'min')::int, 0);
    v_max := CASE WHEN v_faixa->>'max' IS NULL OR v_faixa->>'max' = 'null'
                  THEN NULL ELSE (v_faixa->>'max')::int END;
    IF p_total_extras >= v_min AND (v_max IS NULL OR p_total_extras <= v_max) THEN
      v_unit := (v_faixa->>'valor')::numeric;
      EXIT;
    END IF;
  END LOOP;

  IF v_unit IS NULL THEN
    SELECT (elem->>'valor')::numeric INTO v_unit
    FROM jsonb_array_elements(v_faixas) AS elem
    ORDER BY (elem->>'min')::int DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(NULLIF(v_unit, 0), v_pacote_unit);
END;
$function$;

-- 6) Sincroniza regras_congeladas.pacote.valorFotoExtra quando sessão altera preço
CREATE OR REPLACE FUNCTION public.sync_gallery_extra_price_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.galeria_id IS NOT NULL
     AND NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra
     AND COALESCE(NEW.valor_foto_extra, 0) > 0 THEN
    UPDATE public.galerias
       SET valor_foto_extra = NEW.valor_foto_extra,
           regras_congeladas = CASE
             WHEN jsonb_typeof(regras_congeladas) = 'object' AND jsonb_typeof(regras_congeladas->'pacote') = 'object'
               THEN jsonb_set(regras_congeladas, '{pacote,valorFotoExtra}', to_jsonb(NEW.valor_foto_extra), true)
             ELSE regras_congeladas
           END
     WHERE id = NEW.galeria_id
       AND COALESCE(valor_foto_extra, 0) IS DISTINCT FROM NEW.valor_foto_extra;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: recalcula valor_total das sessões
UPDATE public.clientes_sessoes SET updated_at = now();
