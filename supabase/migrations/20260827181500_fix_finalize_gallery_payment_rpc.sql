-- ==============================================================================
-- Migration: 20260827181500_fix_finalize_gallery_payment_rpc.sql
-- Description: Ajusta a RPC finalize_gallery_payment para utilizar o valor nominal real
-- de dados_extras->>'valorBase' para compor o total vendido da galeria.
-- Resolve o superavit/inflacao gerado no dashboard de galerias pelo repasse
-- de taxas do Asaas Transparente.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(p_cobranca_id uuid, p_paid_at timestamp with time zone DEFAULT now(), p_manual_method text DEFAULT NULL, p_manual_obs text DEFAULT NULL, p_receipt_url text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cobranca record;
  v_galeria_id uuid;
  v_sum_qtd int;
  v_sum_val numeric;
  v_final_status text;
  v_unit numeric;
  v_match text[];
  v_inferred_qtd int := NULL;
  v_gallery_synced boolean := false;
  v_toca_galeria boolean := false;
BEGIN
  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cobranca nao encontrada');
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
            IF ABS(COALESCE(v_cobranca.valor_extras_componente, COALESCE((v_cobranca.dados_extras->>'valorBase')::numeric, v_cobranca.valor))
                    - ROUND(COALESCE(v_cobranca.valor_extras_componente, COALESCE((v_cobranca.dados_extras->>'valorBase')::numeric, v_cobranca.valor)) / v_unit) * v_unit) < 0.02 THEN
              v_inferred_qtd := ROUND(COALESCE(v_cobranca.valor_extras_componente, COALESCE((v_cobranca.dados_extras->>'valorBase')::numeric, v_cobranca.valor)) / v_unit)::INT;
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
                 WHEN finalidade = 'fotos_extras' THEN COALESCE((dados_extras->>'valorBase')::numeric, valor)
                 WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, COALESCE((dados_extras->>'valorBase')::numeric, valor))
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

      -- Cancelar cobranças pendentes órfãs/substituídas da mesma galeria
      UPDATE public.cobrancas
         SET status = 'cancelado',
             obs_manual = COALESCE(obs_manual, 'Cancelada automaticamente — substituída por cobrança paga ' || p_cobranca_id::text),
             updated_at = now()
       WHERE galeria_id = v_galeria_id
         AND id <> p_cobranca_id
         AND status IN ('pendente', 'aguardando_confirmacao')
         AND finalidade IN ('fotos_extras','sessao_e_extras');

      v_gallery_synced := true;

      -- Recomputo explícito: força o gatilho BEFORE UPDATE
      -- 	rigger_recalculate_valor_total a rodar depois que os totais da
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
               WHEN finalidade = 'fotos_extras' THEN COALESCE((dados_extras->>'valorBase')::numeric, valor)
               WHEN finalidade = 'sessao_e_extras' THEN COALESCE(valor_extras_componente, COALESCE((dados_extras->>'valorBase')::numeric, valor))
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

    -- Cancelar cobranças pendentes órfãs/substituídas da mesma galeria
    UPDATE public.cobrancas
       SET status = 'cancelado',
           obs_manual = COALESCE(obs_manual, 'Cancelada automaticamente — substituída por cobrança paga ' || p_cobranca_id::text),
           updated_at = now()
     WHERE galeria_id = v_galeria_id
       AND id <> p_cobranca_id
       AND status IN ('pendente', 'aguardando_confirmacao')
       AND finalidade IN ('fotos_extras','sessao_e_extras');

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
