
-- =========================================================================
-- Fase A — Canonicaliza cálculo de fotos extras + fonte única de finanças
-- =========================================================================

-- 1) Reescreve recalculate_fotos_extras_total: usa _extra_unit_price_for_quantity
--    aplicado à QTD ATUAL DA SESSÃO. Sem mais condição de paridade com a galeria.
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_regras     jsonb;
  v_valor_fixo numeric;
  v_qtd        integer;
  v_unit       numeric;
BEGIN
  -- Manual override: pular sincronização automática.
  IF COALESCE(NEW.extras_overridden, false) = true THEN
    IF NEW.qtd_fotos_extra IS NOT NULL THEN
      NEW.valor_total_foto_extra := ROUND(
        (COALESCE(NEW.qtd_fotos_extra, 0) * COALESCE(NEW.valor_foto_extra, 0))::numeric,
        2
      );
    END IF;
    RETURN NEW;
  END IF;

  v_qtd := COALESCE(NEW.qtd_fotos_extra, 0);

  -- Fonte de regras: preferir regras_congeladas da própria sessão; senão da galeria.
  v_regras := NEW.regras_congeladas;
  IF (v_regras IS NULL OR jsonb_typeof(v_regras) <> 'object') AND NEW.galeria_id IS NOT NULL THEN
    SELECT g.regras_congeladas
      INTO v_regras
      FROM public.galerias g
     WHERE g.id = NEW.galeria_id;
  END IF;

  v_valor_fixo := COALESCE(
    NULLIF(NEW.valor_foto_extra, 0),
    NULLIF((v_regras->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((v_regras->'pacote'->>'valorFotoExtra')::numeric, 0),
    0
  );

  -- Calcula o preço unitário da faixa correspondente à QTD ATUAL DA SESSÃO.
  IF v_qtd > 0 THEN
    v_unit := public._extra_unit_price_for_quantity(v_regras, v_valor_fixo, v_qtd);
    IF v_unit IS NULL OR v_unit = 0 THEN
      v_unit := v_valor_fixo;
    END IF;
    NEW.valor_foto_extra := v_unit;
    NEW.valor_total_foto_extra := ROUND((v_qtd * v_unit)::numeric, 2);
  ELSE
    NEW.valor_foto_extra := v_valor_fixo;
    NEW.valor_total_foto_extra := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Recria trigger recalc_valor_total incluindo qtd_fotos_extra + valor_foto_extra
DROP TRIGGER IF EXISTS trigger_recalculate_valor_total ON public.clientes_sessoes;
CREATE TRIGGER trigger_recalculate_valor_total
  BEFORE INSERT OR UPDATE OF
    valor_base_pacote,
    valor_total_foto_extra,
    valor_foto_extra,
    qtd_fotos_extra,
    valor_adicional,
    produtos_incluidos,
    desconto
  ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_session_valor_total();

-- 3) RPC autoritativa por sessão
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
  credito_utilizado          numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_s              RECORD;
  v_regras         jsonb;
  v_valor_fixo     numeric;
  v_unit_c_desc    numeric;
  v_unit_sem_desc  numeric;
  v_produtos       numeric := 0;
  v_qtd            integer;
  v_gal_qtd        integer := 0;
BEGIN
  SELECT s.id, s.user_id, s.valor_base_pacote, s.valor_foto_extra,
         s.valor_total_foto_extra, s.qtd_fotos_extra, s.valor_adicional,
         s.desconto, s.produtos_incluidos, s.valor_total, s.valor_pago,
         s.galeria_id, s.regras_congeladas
    INTO v_s
    FROM public.clientes_sessoes s
   WHERE s.id = p_session_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Produtos manuais
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

  v_qtd := COALESCE(v_s.qtd_fotos_extra, 0);
  v_regras := v_s.regras_congeladas;
  IF (v_regras IS NULL OR jsonb_typeof(v_regras) <> 'object') AND v_s.galeria_id IS NOT NULL THEN
    SELECT g.regras_congeladas, g.total_fotos_extras_vendidas
      INTO v_regras, v_gal_qtd
      FROM public.galerias g
     WHERE g.id = v_s.galeria_id;
  ELSIF v_s.galeria_id IS NOT NULL THEN
    SELECT COALESCE(g.total_fotos_extras_vendidas, 0)
      INTO v_gal_qtd
      FROM public.galerias g
     WHERE g.id = v_s.galeria_id;
  END IF;

  v_valor_fixo := COALESCE(
    NULLIF(v_s.valor_foto_extra, 0),
    NULLIF((v_regras->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((v_regras->'pacote'->>'valorFotoExtra')::numeric, 0),
    0
  );
  v_unit_sem_desc := v_valor_fixo;
  v_unit_c_desc   := public._extra_unit_price_for_quantity(v_regras, v_valor_fixo, v_qtd);
  IF v_unit_c_desc IS NULL OR v_unit_c_desc = 0 THEN
    v_unit_c_desc := v_valor_fixo;
  END IF;

  session_id                := v_s.id;
  valor_base_pacote         := COALESCE(v_s.valor_base_pacote, 0);
  valor_produtos            := v_produtos;
  valor_extras_bruto        := ROUND((v_qtd * v_unit_sem_desc)::numeric, 2);
  valor_extras_com_desconto := COALESCE(v_s.valor_total_foto_extra, ROUND((v_qtd * v_unit_c_desc)::numeric, 2));
  desconto_progressivo      := GREATEST(0, valor_extras_bruto - valor_extras_com_desconto);
  desconto_manual           := COALESCE(v_s.desconto, 0);
  valor_adicional           := COALESCE(v_s.valor_adicional, 0);
  valor_total               := COALESCE(v_s.valor_total, 0);
  valor_pago                := LEAST(COALESCE(v_s.valor_pago, 0), COALESCE(v_s.valor_total, 0));
  valor_pendente            := GREATEST(0, COALESCE(v_s.valor_total, 0) - COALESCE(v_s.valor_pago, 0));
  qtd_fotos_extra           := v_qtd;
  qtd_extras_galeria        := v_gal_qtd;

  -- Créditos gerados/consumidos vinculados a esta sessão
  SELECT
    COALESCE(SUM(CASE WHEN l.tipo = 'credito' THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'debito'  THEN l.valor ELSE 0 END), 0)
    INTO credito_gerado, credito_utilizado
  FROM public.cliente_creditos_ledger l
  WHERE l.user_id = v_s.user_id
    AND (
      l.session_id_origem = v_s.id
      OR l.session_id_consumo = v_s.id
    );

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_session_financials(uuid) TO authenticated, service_role;

-- 4) RPC batch por mês
CREATE OR REPLACE FUNCTION public.workflow_month_session_financials(
  p_user_id uuid,
  p_start   date,
  p_end     date
)
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
  credito_utilizado          numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r RECORD;
  f RECORD;
BEGIN
  FOR r IN
    SELECT s.id
      FROM public.clientes_sessoes s
     WHERE s.user_id = p_user_id
       AND s.data_sessao >= p_start
       AND s.data_sessao <= p_end
       AND (s.status IS NULL OR s.status <> 'historico')
  LOOP
    FOR f IN SELECT * FROM public.workflow_session_financials(r.id) LOOP
      session_id                := f.session_id;
      valor_base_pacote         := f.valor_base_pacote;
      valor_produtos            := f.valor_produtos;
      valor_extras_bruto        := f.valor_extras_bruto;
      valor_extras_com_desconto := f.valor_extras_com_desconto;
      desconto_progressivo      := f.desconto_progressivo;
      desconto_manual           := f.desconto_manual;
      valor_adicional           := f.valor_adicional;
      valor_total               := f.valor_total;
      valor_pago                := f.valor_pago;
      valor_pendente            := f.valor_pendente;
      qtd_fotos_extra           := f.qtd_fotos_extra;
      qtd_extras_galeria        := f.qtd_extras_galeria;
      credito_gerado            := f.credito_gerado;
      credito_utilizado         := f.credito_utilizado;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_month_session_financials(uuid, date, date)
  TO authenticated, service_role;

-- 5) Backfill: força triggers a reprocessarem sessões com galeria vinculada.
UPDATE public.clientes_sessoes
   SET updated_at = now()
 WHERE galeria_id IS NOT NULL
   AND COALESCE(extras_overridden, false) = false
   AND COALESCE(qtd_fotos_extra, 0) > 0;
