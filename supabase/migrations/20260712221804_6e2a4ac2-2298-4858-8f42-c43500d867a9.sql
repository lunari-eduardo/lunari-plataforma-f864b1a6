
-- ============================================================
-- 1) sync_gallery_extras_to_session: remover derivação via cobranças
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_frozen NUMERIC;
  v_unit_frozen_base NUMERIC;
  v_unit_efetivo NUMERIC;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
BEGIN
  IF pg_trigger_depth() >= 2 THEN
    RETURN NEW;
  END IF;

  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  v_selecao_atualizou := (
    NEW.status = 'selecao_completa'
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
  );

  IF v_extras_mudou OR v_selecao_atualizou THEN
    -- Unit efetivo: SOMENTE das regras congeladas (fonte da verdade).
    -- NUNCA derivado de somatório de cobranças.
    v_unit_frozen := NULLIF(
      (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
      0
    );
    v_unit_frozen_base := NULLIF(
      (NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric,
      0
    );

    v_unit_efetivo := COALESCE(
      v_unit_frozen,
      v_unit_frozen_base,
      NULLIF(NEW.valor_foto_extra, 0),
      0
    );

    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa' THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    -- Sem unit confiável -> não escreve preço na sessão.
    IF v_unit_efetivo > 0 THEN
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
    END IF;
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

-- ============================================================
-- 2) finalize_gallery_payment: preservar finalidade e somar componente correto
-- ============================================================
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
  v_sum_qtd INT;
  v_sum_val NUMERIC;
  v_inferred_qtd INT;
  v_unit NUMERIC;
  v_match TEXT[];
  v_toca_galeria BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF v_cobranca IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;

  v_toca_galeria := COALESCE(v_cobranca.finalidade,'') IN ('fotos_extras','sessao_e_extras');

  IF v_toca_galeria AND v_cobranca.galeria_id IS NOT NULL THEN
    v_galeria_id := v_cobranca.galeria_id;
  ELSIF v_toca_galeria
        AND v_cobranca.session_id IS NOT NULL
        AND v_cobranca.user_id IS NOT NULL
        AND COALESCE(v_cobranca.tipo_cobranca,'') NOT IN ('pacote','plano','assinatura')
  THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = v_cobranca.session_id
       AND user_id = v_cobranca.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;

    IF v_galeria_id IS NOT NULL THEN
      IF COALESCE(v_cobranca.qtd_fotos, 0) <= 0 AND COALESCE(v_cobranca.valor,0) > 0 THEN
        v_match := regexp_match(COALESCE(v_cobranca.descricao,''), '(\d+)\s*foto', 'i');
        IF v_match IS NOT NULL THEN
          v_inferred_qtd := (v_match[1])::INT;
        END IF;
        IF v_inferred_qtd IS NULL OR v_inferred_qtd = 0 THEN
          SELECT NULLIF(valor_foto_extra, 0) INTO v_unit FROM public.galerias WHERE id = v_galeria_id;
          IF v_unit IS NOT NULL AND v_unit > 0 THEN
            IF ABS(COALESCE(v_cobranca.valor_extras_componente, v_cobranca.valor)
                    - ROUND(COALESCE(v_cobranca.valor_extras_componente, v_cobranca.valor) / v_unit) * v_unit) < 0.02 THEN
              v_inferred_qtd := ROUND(COALESCE(v_cobranca.valor_extras_componente, v_cobranca.valor) / v_unit)::INT;
            END IF;
          END IF;
        END IF;
      END IF;

      -- Vincula galeria mas PRESERVA a finalidade original.
      UPDATE public.cobrancas
         SET galeria_id = v_galeria_id,
             qtd_fotos = COALESCE(NULLIF(qtd_fotos, 0), v_inferred_qtd, qtd_fotos),
             updated_at = now()
       WHERE id = p_cobranca_id;
      SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id;
    ELSE
      v_galeria_id := NULL;
    END IF;
  ELSE
    v_galeria_id := NULL;
  END IF;

  IF v_cobranca.status IN ('pago','pago_manual') THEN
    IF v_galeria_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(g.fotos_selecionadas,0)
              - COALESCE(NULLIF(v_cobranca.snapshot_fotos_incluidas, 0), g.fotos_incluidas, 0), 0)
        INTO v_sum_qtd
        FROM public.galerias g WHERE g.id = v_galeria_id;

      -- Somar apenas o componente de extras (combinadas) ou valor cheio (extras puras)
      SELECT COALESCE(SUM(
               CASE
                 WHEN finalidade = 'fotos_extras' THEN valor
                 WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
                 ELSE 0
               END
             ), 0)::numeric INTO v_sum_val
        FROM public.cobrancas
       WHERE galeria_id = v_galeria_id
         AND finalidade IN ('fotos_extras','sessao_e_extras')
         AND status IN ('pago','pago_manual');

      UPDATE public.galerias
         SET status = 'selecao_completa',
             total_fotos_extras_vendidas = v_sum_qtd,
             valor_total_vendido = v_sum_val,
             status_pagamento = v_cobranca.status,
             status_selecao = 'selecao_completa',
             finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento, now()),
             updated_at = now()
       WHERE id = v_galeria_id;

      UPDATE public.cobrancas SET extras_contabilizados = true
       WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

      v_gallery_synced := true;
    END IF;

    IF v_cobranca.visitor_id IS NOT NULL THEN
      UPDATE public.galeria_visitantes
         SET status = 'finalizado', status_selecao = 'selecao_completa',
             finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
       WHERE id = v_cobranca.visitor_id AND status <> 'finalizado';
    END IF;

    RETURN jsonb_build_object('success', true, 'already_paid', true,
      'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
  END IF;

  UPDATE public.cobrancas
     SET status = v_final_status,
         data_pagamento = COALESCE(p_paid_at, now()),
         ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
         obs_manual = COALESCE(p_manual_obs, obs_manual),
         updated_at = now()
   WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas,0)
            - COALESCE(NULLIF(v_cobranca.snapshot_fotos_incluidas, 0), g.fotos_incluidas, 0), 0)
      INTO v_sum_qtd
      FROM public.galerias g WHERE g.id = v_galeria_id;

    SELECT COALESCE(SUM(
             CASE
               WHEN finalidade = 'fotos_extras' THEN valor
               WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
               ELSE 0
             END
           ), 0)::numeric INTO v_sum_val
      FROM public.cobrancas
     WHERE galeria_id = v_galeria_id
       AND finalidade IN ('fotos_extras','sessao_e_extras')
       AND status IN ('pago','pago_manual');

    UPDATE public.galerias
       SET status = 'selecao_completa',
           total_fotos_extras_vendidas = v_sum_qtd,
           valor_total_vendido = v_sum_val,
           status_pagamento = v_final_status,
           status_selecao = 'selecao_completa',
           finalized_at = COALESCE(finalized_at, COALESCE(p_paid_at, now())),
           updated_at = now()
     WHERE id = v_galeria_id;

    UPDATE public.cobrancas SET extras_contabilizados = true
     WHERE id = p_cobranca_id AND extras_contabilizados IS NOT TRUE;

    v_gallery_synced := true;
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
       SET status = 'finalizado', status_selecao = 'selecao_completa',
           finalized_at = COALESCE(p_paid_at, now()), updated_at = now()
     WHERE id = v_cobranca.visitor_id AND status <> 'finalizado';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', false,
    'gallery_synced', v_gallery_synced, 'galeria_id', v_galeria_id);
END;
$function$;

-- ============================================================
-- 3) Saneamento dos dados afetados
-- ============================================================
DO $saneamento$
DECLARE
  v_new_sum NUMERIC;
BEGIN
  UPDATE public.cobrancas
     SET finalidade = 'sessao_e_extras',
         updated_at = now()
   WHERE id = '63b41aae-8e20-4a32-9438-e53e41f0f944'
     AND finalidade = 'fotos_extras';

  SELECT COALESCE(SUM(
           CASE
             WHEN finalidade = 'fotos_extras' THEN valor
             WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
             ELSE 0
           END
         ), 0)
    INTO v_new_sum
    FROM public.cobrancas
   WHERE galeria_id = '367acf3c-bb56-4861-8856-99b1e90afe27'
     AND finalidade IN ('fotos_extras','sessao_e_extras')
     AND status IN ('pago','pago_manual');

  UPDATE public.galerias
     SET valor_total_vendido = v_new_sum,
         updated_at = now()
   WHERE id = '367acf3c-bb56-4861-8856-99b1e90afe27';

  UPDATE public.clientes_sessoes
     SET valor_foto_extra = 2,
         qtd_fotos_extra = 12,
         valor_total_foto_extra = 24,
         updated_at = now()
   WHERE id = '32989f35-0d19-419b-9262-ea3538dc4644';
END
$saneamento$;
