
-- =========================================================
-- Bug 1 — Parte A: guard no gerador de crédito automático
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_auto_credit_overpay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id text;
  v_session_uuid uuid;
  v_cliente_id uuid;
  v_user_id uuid;
  v_valor_total numeric;
  v_valor_pago_externo numeric;
  v_credito_atual numeric;
  v_delta_desejado numeric;
  v_ajuste numeric;
  v_galeria_id uuid;
  v_gallery_paid numeric;
BEGIN
  IF TG_TABLE_NAME = 'clientes_transacoes' THEN
    v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  ELSIF TG_TABLE_NAME = 'clientes_sessoes' THEN
    v_session_id := NEW.session_id;
  END IF;

  IF v_session_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, cliente_id, user_id, COALESCE(valor_total, 0), galeria_id
    INTO v_session_uuid, v_cliente_id, v_user_id, v_valor_total, v_galeria_id
  FROM public.clientes_sessoes
  WHERE session_id = v_session_id;

  IF v_session_uuid IS NULL OR v_cliente_id IS NULL OR v_valor_total <= 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_valor_pago_externo := public.compute_valor_pago_externo(v_session_id);
  v_delta_desejado := GREATEST(v_valor_pago_externo - v_valor_total, 0);

  -- GUARD: se a sessão tem galeria vinculada, o "excesso" pode ser apenas o
  -- pagamento de extras que ainda não foi propagado para o valor_total. Nesse
  -- caso, NÃO gerar crédito automático — o excesso é legítimo (será refletido
  -- no valor_total assim que qtd_fotos_extra for atualizada).
  IF v_delta_desejado > 0 AND v_galeria_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
             CASE
               WHEN finalidade = 'fotos_extras' THEN valor
               WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
               ELSE 0
             END
           ), 0)::numeric
      INTO v_gallery_paid
      FROM public.cobrancas
     WHERE session_id = v_session_id
       AND finalidade IN ('fotos_extras','sessao_e_extras')
       AND status IN ('pago','pago_manual');

    -- Tolerância de R$ 0,02 para arredondamento. Se o excesso está coberto
    -- por cobranças de galeria pagas, ignora a geração/reversão automática.
    IF v_delta_desejado <= v_gallery_paid + 0.02 THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_credito_atual
  FROM public.cliente_creditos_ledger
  WHERE session_id_origem = v_session_id
    AND origem IN ('overpay', 'reducao_escopo', 'reversao_grant');

  v_ajuste := v_delta_desejado - v_credito_atual;

  IF v_ajuste = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_ajuste > 0 THEN
    INSERT INTO public.cliente_creditos_ledger (
      user_id, cliente_id, data, valor, origem,
      session_id_origem, descricao, created_by
    ) VALUES (
      v_user_id, v_cliente_id, CURRENT_DATE, v_ajuste,
      CASE WHEN TG_TABLE_NAME = 'clientes_sessoes' THEN 'reducao_escopo' ELSE 'overpay' END,
      v_session_id,
      'Crédito automático (' || CASE WHEN TG_TABLE_NAME = 'clientes_sessoes' THEN 'redução de escopo' ELSE 'pagamento a maior' END || ')',
      v_user_id
    );
  ELSE
    IF v_credito_atual > 0 THEN
      INSERT INTO public.cliente_creditos_ledger (
        user_id, cliente_id, data, valor, origem,
        session_id_origem, descricao, created_by
      ) VALUES (
        v_user_id, v_cliente_id, CURRENT_DATE, GREATEST(v_ajuste, -v_credito_atual),
        'reversao_grant',
        v_session_id,
        'Ajuste automático de crédito (recomputo)',
        v_user_id
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =========================================================
-- Bug 1 — Parte B: finalize_gallery_payment força recomputo
-- do valor_total ANTES do trigger de crédito ver o estado.
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(p_cobranca_id uuid, p_receipt_url text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_manual_method text DEFAULT NULL::text, p_manual_obs text DEFAULT NULL::text)
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

      -- Recomputo explícito: força o gatilho BEFORE UPDATE
      -- `trigger_recalculate_valor_total` a rodar depois que os totais da
      -- galeria já foram gravados, garantindo valor_total correto ANTES do
      -- gatilho AFTER de crédito enxergar as transações.
      UPDATE public.clientes_sessoes
         SET updated_at = now()
       WHERE galeria_id = v_galeria_id;
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

    -- Recomputo explícito (mesmo motivo do bloco anterior).
    UPDATE public.clientes_sessoes
       SET updated_at = now()
     WHERE galeria_id = v_galeria_id;
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

-- =========================================================
-- Bug 1 — Parte D: reparo one-shot dos créditos overpay
-- gerados por descompasso Gallery→Session.
-- =========================================================
WITH candidatos AS (
  SELECT
    l.session_id_origem,
    s.cliente_id,
    s.user_id,
    -- saldo líquido de crédito automático desta sessão
    SUM(l.valor) AS saldo_credito_auto
  FROM public.cliente_creditos_ledger l
  JOIN public.clientes_sessoes s ON s.session_id = l.session_id_origem
  WHERE l.origem IN ('overpay','reversao_grant')
    AND s.galeria_id IS NOT NULL
  GROUP BY l.session_id_origem, s.cliente_id, s.user_id
),
cobertura AS (
  SELECT c.session_id_origem,
         c.cliente_id,
         c.user_id,
         c.saldo_credito_auto,
         COALESCE((
           SELECT SUM(CASE
                        WHEN cob.finalidade = 'fotos_extras' THEN cob.valor
                        WHEN cob.finalidade = 'sessao_e_extras' THEN COALESCE(cob.valor_extras_componente,0)
                        ELSE 0
                      END)
             FROM public.cobrancas cob
            WHERE cob.session_id = c.session_id_origem
              AND cob.finalidade IN ('fotos_extras','sessao_e_extras')
              AND cob.status IN ('pago','pago_manual')
         ), 0) AS gallery_paid
  FROM candidatos c
)
INSERT INTO public.cliente_creditos_ledger (
  user_id, cliente_id, data, valor, origem,
  session_id_origem, descricao, created_by
)
SELECT
  user_id, cliente_id, CURRENT_DATE,
  -saldo_credito_auto,
  'reversao_grant',
  session_id_origem,
  'Reparo automático — overpay coberto por cobrança de galeria (reparo_gallery_overpay_2026_07_24)',
  user_id
FROM cobertura
WHERE saldo_credito_auto > 0
  AND saldo_credito_auto <= gallery_paid + 0.02;

-- =========================================================
-- Bug 1 — Fix pontual: força recomputo do valor_total da
-- sessão de Roberta Efel – Hariel (18/07).
-- =========================================================
UPDATE public.clientes_sessoes
   SET updated_at = now()
 WHERE session_id = 'workflow-1784067506630-akfnyghqdy';
