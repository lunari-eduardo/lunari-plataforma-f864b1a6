
-- ============================================================
-- PASSO 1+2+4: Endurecer sync_gallery_extras_to_session e guarda
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_frozen NUMERIC;
  v_unit_from_charges NUMERIC;
  v_unit_efetivo NUMERIC;
  v_extras_paid_sum NUMERIC;
  v_extras_paid_qtd INT;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
  v_has_paid_extras BOOLEAN := false;
  v_rows_by_fk INT := 0;
  v_rows_by_slug INT := 0;
BEGIN
  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  -- Detectar cobrança paga (permite propagar mesmo em reabertura)
  SELECT EXISTS(
    SELECT 1 FROM public.cobrancas
     WHERE galeria_id = NEW.id
       AND status IN ('pago','pago_manual')
       AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras')
  ) INTO v_has_paid_extras;

  v_selecao_atualizou := (
    (
      NEW.status = 'selecao_completa'
      OR (v_has_paid_extras AND NEW.status IN ('selecao_iniciada','em_selecao'))
    )
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM NEW.status
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
  );

  IF v_extras_mudou OR v_selecao_atualizou THEN
    v_unit_frozen := NULLIF(
      (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
      0
    );

    SELECT
      COALESCE(SUM(COALESCE(valor_extras_componente, valor)), 0),
      COALESCE(SUM(qtd_fotos), 0)::int
      INTO v_extras_paid_sum, v_extras_paid_qtd
    FROM public.cobrancas
    WHERE galeria_id = NEW.id
      AND status IN ('pago','pago_manual')
      AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras');

    v_unit_from_charges := CASE
      WHEN v_extras_paid_qtd > 0 AND v_extras_paid_sum > 0
      THEN ROUND((v_extras_paid_sum / v_extras_paid_qtd)::numeric, 2)
      ELSE NULL
    END;

    v_unit_efetivo := COALESCE(
      v_unit_frozen,
      v_unit_from_charges,
      ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2)
    );

    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa'
       OR (v_has_paid_extras AND NEW.status IN ('selecao_iniciada','em_selecao')) THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    -- Marcador de "sync confiável" para relaxar guarda de aumento pré-seleção
    PERFORM set_config('lunari.trusted_sync', '1', true);

    -- (a) Caminho FK direto
    UPDATE public.clientes_sessoes s
    SET valor_foto_extra = v_unit_efetivo,
        qtd_fotos_extra = v_qtd_total,
        valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
        updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND COALESCE(s.extras_overridden, false) = false
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total
        OR s.valor_total_foto_extra IS DISTINCT FROM ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2)
      );
    GET DIAGNOSTICS v_rows_by_fk = ROW_COUNT;

    -- (b) Fallback slug + auto-tie (idempotente): sessão que ainda não tem galeria_id
    IF v_rows_by_fk = 0 AND NEW.session_id IS NOT NULL THEN
      UPDATE public.clientes_sessoes s
      SET galeria_id = NEW.id,
          valor_foto_extra = v_unit_efetivo,
          qtd_fotos_extra = v_qtd_total,
          valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
          updated_at = now()
      WHERE s.user_id = NEW.user_id
        AND s.session_id = NEW.session_id
        AND s.galeria_id IS NULL
        AND COALESCE(s.extras_overridden, false) = false;
      GET DIAGNOSTICS v_rows_by_slug = ROW_COUNT;
    END IF;

    PERFORM set_config('lunari.trusted_sync', '0', true);

    INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, user_id, metadata)
    VALUES(
      'sync_gallery_extras',
      'galeria', NEW.id, NEW.id, NEW.user_id,
      jsonb_build_object(
        'qtd', v_qtd_total,
        'unit', v_unit_efetivo,
        'gal_status', NEW.status,
        'rows_by_fk', v_rows_by_fk,
        'rows_by_slug', v_rows_by_slug,
        'has_paid_extras', v_has_paid_extras
      )
    );
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

-- Guarda relaxada quando sync confiável está ativo (via GUC)
CREATE OR REPLACE FUNCTION public.guard_qtd_fotos_extra_pre_selecao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_status text;
  v_has_paid boolean := false;
  v_trusted text;
BEGIN
  IF NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.qtd_fotos_extra, 0) <= COALESCE(OLD.qtd_fotos_extra, 0) THEN
    RETURN NEW;
  END IF;

  -- Sync confiável iniciada por sync_gallery_extras_to_session: liberar
  v_trusted := current_setting('lunari.trusted_sync', true);
  IF v_trusted = '1' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_gal_status
    FROM public.galerias
   WHERE id = NEW.galeria_id;

  IF v_gal_status IN ('rascunho', 'enviado', 'selecao_iniciada') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cobrancas c
       WHERE c.galeria_id = NEW.galeria_id
         AND c.finalidade IN ('fotos_extras','sessao_e_extras')
         AND c.status IN ('pago','pago_manual')
    ) INTO v_has_paid;

    IF NOT v_has_paid THEN
      INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, metadata)
      VALUES(
        'guard_qtd_reverted', 'clientes_sessoes', NEW.id, NEW.user_id,
        jsonb_build_object(
          'old_qtd', OLD.qtd_fotos_extra,
          'attempted_qtd', NEW.qtd_fotos_extra,
          'gal_status', v_gal_status
        )
      );
      NEW.qtd_fotos_extra := COALESCE(OLD.qtd_fotos_extra, 0);
      NEW.valor_total_foto_extra := COALESCE(OLD.valor_total_foto_extra, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- PASSO 3: Trigger AFTER DELETE em galerias
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_galeria_deleted_reset_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_qtd_final INT;
  v_unit NUMERIC;
  v_paid_qtd INT := 0;
  v_paid_sum NUMERIC := 0;
BEGIN
  IF OLD.session_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Base: quantidade já vendida (preserva integridade financeira)
  v_qtd_final := COALESCE(OLD.total_fotos_extras_vendidas, 0);

  -- Fallback: contar por cobranças pagas históricas
  SELECT COALESCE(SUM(qtd_fotos), 0)::int, COALESCE(SUM(COALESCE(valor_extras_componente, valor)), 0)
    INTO v_paid_qtd, v_paid_sum
  FROM public.cobrancas
  WHERE session_id = OLD.session_id
    AND status IN ('pago','pago_manual')
    AND COALESCE(finalidade,'') IN ('fotos_extras','sessao_e_extras');

  IF v_paid_qtd > v_qtd_final THEN
    v_qtd_final := v_paid_qtd;
  END IF;

  v_unit := CASE
    WHEN v_qtd_final > 0 AND v_paid_sum > 0
    THEN ROUND((v_paid_sum / GREATEST(v_paid_qtd, v_qtd_final))::numeric, 2)
    ELSE COALESCE(OLD.valor_foto_extra, 0)
  END;

  UPDATE public.clientes_sessoes s
  SET qtd_fotos_extra = v_qtd_final,
      valor_foto_extra = CASE WHEN v_qtd_final > 0 THEN v_unit ELSE 0 END,
      valor_total_foto_extra = ROUND((v_qtd_final * CASE WHEN v_qtd_final > 0 THEN v_unit ELSE 0 END)::numeric, 2),
      updated_at = now()
  WHERE s.user_id = OLD.user_id
    AND s.session_id = OLD.session_id
    AND COALESCE(s.extras_overridden, false) = false;

  INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, user_id, metadata)
  VALUES(
    'on_galeria_deleted_reset',
    'galeria', OLD.id, OLD.id, OLD.user_id,
    jsonb_build_object(
      'session_slug', OLD.session_id,
      'qtd_final', v_qtd_final,
      'unit', v_unit,
      'old_vendidas', OLD.total_fotos_extras_vendidas,
      'paid_qtd', v_paid_qtd
    )
  );

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_on_galeria_deleted_reset_session ON public.galerias;
CREATE TRIGGER trg_on_galeria_deleted_reset_session
AFTER DELETE ON public.galerias
FOR EACH ROW EXECUTE FUNCTION public.on_galeria_deleted_reset_session();

-- ============================================================
-- PASSO 7: View de divergência
-- ============================================================
CREATE OR REPLACE VIEW public.v_workflow_extras_divergence AS
SELECT
  s.id AS session_id,
  s.user_id,
  s.cliente_id,
  s.session_id AS session_slug,
  s.galeria_id,
  s.qtd_fotos_extra AS qtd_sessao,
  (SELECT qtd_fotos_extra FROM public.workflow_session_financials(s.id)) AS qtd_rpc,
  s.updated_at
FROM public.clientes_sessoes s
WHERE s.galeria_id IS NOT NULL
  AND (SELECT qtd_fotos_extra FROM public.workflow_session_financials(s.id)) IS DISTINCT FROM s.qtd_fotos_extra;

GRANT SELECT ON public.v_workflow_extras_divergence TO authenticated;
GRANT ALL ON public.v_workflow_extras_divergence TO service_role;

-- ============================================================
-- PASSO 6: Backfill único (reprocessa todas as galerias vivas)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.galerias LOOP
    UPDATE public.galerias SET updated_at = updated_at WHERE id = r.id;
    -- NO-OP update para forçar sync? Não dispara AFTER UPDATE OF cols específicas.
    -- Em vez disso, chamamos o efeito diretamente via UPDATE de fotos_selecionadas para o mesmo valor:
    UPDATE public.galerias
      SET fotos_selecionadas = fotos_selecionadas
      WHERE id = r.id;
  END LOOP;
END $$;
