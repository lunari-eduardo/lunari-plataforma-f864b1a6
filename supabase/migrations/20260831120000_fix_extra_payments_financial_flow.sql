-- ==============================================================================
-- Migration: 20260831120000_fix_extra_payments_financial_flow.sql
-- Description: Correção definitiva do registro de pagamentos de fotos extras no fluxo financeiro.
-- 1. Ativa o trigger trg_auto_finalize_cobrancas na tabela public.cobrancas.
-- 2. Atualiza a RPC finalize_gallery_payment com sincronização completa de galerias e clientes_sessoes.
-- 3. Recria a View extrato_unificado com joins em cascata e normalização contábil de gateway_cash_movements.
-- 4. Atualiza workflow_month_metrics e workflow_range_metrics para incluir gateway_cash_movements no caixa_recebido.
-- 5. Executa reconciliação retroativa de cobranças de extras já pagas.
-- ==============================================================================

-- 1. Atualizar a função e CRIAR o trigger trg_auto_finalize_cobrancas em public.cobrancas
CREATE OR REPLACE FUNCTION public.tg_auto_finalize_cobrancas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('pago', 'pago_manual')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual'))
     AND NEW.finalidade IN ('fotos_extras', 'sessao_e_extras')
     AND NEW.extras_contabilizados IS NOT TRUE
  THEN
    BEGIN
      PERFORM public.finalize_gallery_payment(
        NEW.id,
        COALESCE(NEW.data_pagamento, now()),
        NEW.metodo_manual,
        NEW.obs_manual,
        NEW.ip_receipt_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-finalize falhou para cobranca %: %', NEW.id, SQLERRM;
      BEGIN
        INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
        VALUES ('auto_finalize_failed', 'cobranca', NEW.id, NEW.galeria_id,
          jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'finalidade', NEW.finalidade));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_finalize_cobrancas ON public.cobrancas;
CREATE TRIGGER trg_auto_finalize_cobrancas
  AFTER INSERT OR UPDATE OF status ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_auto_finalize_cobrancas();


-- 2. Atualizar a RPC finalize_gallery_payment para sincronização completa e consistente
CREATE OR REPLACE FUNCTION public.finalize_gallery_payment(
  p_cobranca_id uuid,
  p_paid_at timestamp with time zone DEFAULT now(),
  p_manual_method text DEFAULT NULL::text,
  p_manual_obs text DEFAULT NULL::text,
  p_receipt_url text DEFAULT NULL::text
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
  v_toca_galeria BOOLEAN := false;
  v_target_session_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_cobranca_id::text));

  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'already_paid', false, 'error', 'Cobranca nao encontrada');
  END IF;

  v_final_status := CASE WHEN p_manual_method IS NOT NULL THEN 'pago_manual' ELSE 'pago' END;
  v_toca_galeria := COALESCE(v_cobranca.finalidade, '') IN ('fotos_extras', 'sessao_e_extras');

  IF v_toca_galeria AND v_cobranca.galeria_id IS NOT NULL THEN
    v_galeria_id := v_cobranca.galeria_id;
  ELSIF v_toca_galeria
        AND v_cobranca.session_id IS NOT NULL
        AND v_cobranca.user_id IS NOT NULL
        AND COALESCE(v_cobranca.tipo_cobranca, '') NOT IN ('pacote', 'plano', 'assinatura')
  THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = v_cobranca.session_id
       AND user_id = v_cobranca.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;

    IF v_galeria_id IS NOT NULL THEN
      IF COALESCE(v_cobranca.qtd_fotos, 0) <= 0 AND COALESCE(v_cobranca.valor, 0) > 0 THEN
        v_match := regexp_match(COALESCE(v_cobranca.descricao, ''), '(\d+)\s*foto', 'i');
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

  -- Atualizar status da cobrança
  UPDATE public.cobrancas
     SET status = v_final_status,
         data_pagamento = COALESCE(p_paid_at, data_pagamento, now()),
         ip_receipt_url = COALESCE(p_receipt_url, ip_receipt_url),
         obs_manual = COALESCE(p_manual_obs, obs_manual),
         updated_at = now()
   WHERE id = p_cobranca_id;

  IF v_galeria_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(g.fotos_selecionadas, 0)
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
       AND finalidade IN ('fotos_extras', 'sessao_e_extras')
       AND status IN ('pago', 'pago_manual');

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
           obs_manual = COALESCE(obs_manual, 'Cancelada automaticamente - substituída por cobrança paga ' || p_cobranca_id::text),
           updated_at = now()
     WHERE galeria_id = v_galeria_id
       AND id <> p_cobranca_id
       AND status IN ('pendente', 'aguardando_confirmacao')
       AND finalidade IN ('fotos_extras', 'sessao_e_extras');

    v_gallery_synced := true;

    -- Forçar recálculo da sessão correspondente
    UPDATE public.clientes_sessoes
       SET galeria_id = COALESCE(galeria_id, v_galeria_id),
           updated_at = now()
     WHERE galeria_id = v_galeria_id
        OR session_id = (SELECT session_id FROM public.galerias WHERE id = v_galeria_id LIMIT 1)
        OR id::text = (SELECT session_id FROM public.galerias WHERE id = v_galeria_id LIMIT 1)
        OR (v_cobranca.session_id IS NOT NULL AND (session_id = v_cobranca.session_id OR id::text = v_cobranca.session_id));
  END IF;

  IF v_cobranca.visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes
       SET status = 'finalizado', status_selecao = 'selecao_completa',
           finalized_at = COALESCE(v_cobranca.data_pagamento, now()), updated_at = now()
     WHERE id = v_cobranca.visitor_id AND status <> 'finalizado';
  END IF;

  -- Recomputar valor_pago da sessão se identificada
  SELECT COALESCE(v_cobranca.session_id, (SELECT session_id FROM public.galerias WHERE id = v_galeria_id LIMIT 1))
    INTO v_target_session_id;

  IF v_target_session_id IS NOT NULL THEN
    BEGIN
      PERFORM public.recompute_session_paid(v_target_session_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_paid', false,
    'gallery_synced', v_gallery_synced,
    'galeria_id', v_galeria_id
  );
END;
$function$;


-- 3. Recriar View extrato_unificado com suporte abrangente e joins em cascata
DROP VIEW IF EXISTS public.extrato_unificado;

CREATE VIEW public.extrato_unificado WITH (security_invoker=on) AS
 -- 1) clientes_transacoes (Pagamentos nao migrados ou que não sejam Asaas com cash_movements)
 SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(NULLIF(TRIM(ct.descricao), ''), 'Pagamento'::text) AS descricao,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text) OR ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    COALESCE(c.nome, cl_sess.nome, 'Cliente') AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    'Receita de Serviços'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento,
    'receita'::text AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
     LEFT JOIN clientes_sessoes cs ON (
       (ct.session_id IS NOT NULL AND (ct.session_id = cs.session_id OR ct.session_id = cs.id::text))
       OR (cob.session_id IS NOT NULL AND (cob.session_id = cs.session_id OR cob.session_id = cs.id::text))
       OR (cob.galeria_id IS NOT NULL AND cob.galeria_id = cs.galeria_id)
     ) AND ct.user_id = cs.user_id
     LEFT JOIN clientes cl_sess ON cs.cliente_id = cl_sess.id
  WHERE ct.tipo = 'pagamento'::text AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
UNION ALL
 -- 2) clientes_transacoes (Estornos nao migrados)
 SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    'Estorno'::text AS descricao,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text) OR ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    COALESCE(c.nome, cl_sess.nome, 'Cliente') AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    'Estorno'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    'estorno'::text AS meio_pagamento,
    'estorno'::text AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
     LEFT JOIN clientes_sessoes cs ON (
       (ct.session_id IS NOT NULL AND (ct.session_id = cs.session_id OR ct.session_id = cs.id::text))
       OR (cob.session_id IS NOT NULL AND (cob.session_id = cs.session_id OR cob.session_id = cs.id::text))
       OR (cob.galeria_id IS NOT NULL AND cob.galeria_id = cs.galeria_id)
     ) AND ct.user_id = cs.user_id
     LEFT JOIN clientes cl_sess ON cs.cliente_id = cl_sess.id
  WHERE ct.tipo = 'estorno'::text AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
UNION ALL
 -- 3) clientes_transacoes (Taxas nao migradas)
 SELECT ct.id::text || '_taxa'::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    'Taxa Gateway / Antecipação'::text AS descricao,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    COALESCE(c.nome, cl_sess.nome, 'Cliente') AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    'Taxas de Gateway'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor - COALESCE(ct.valor_liquido, ct.valor) AS valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento,
    'taxa_gateway'::text AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s*extra|\[extras|fotos_extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
     LEFT JOIN clientes_sessoes cs ON (
       (ct.session_id IS NOT NULL AND (ct.session_id = cs.session_id OR ct.session_id = cs.id::text))
       OR (cob.session_id IS NOT NULL AND (cob.session_id = cs.session_id OR cob.session_id = cs.id::text))
       OR (cob.galeria_id IS NOT NULL AND cob.galeria_id = cs.galeria_id)
     ) AND ct.user_id = cs.user_id
     LEFT JOIN clientes cl_sess ON cs.cliente_id = cl_sess.id
  WHERE ct.tipo = 'pagamento'::text AND ct.valor_liquido IS NOT NULL AND ct.valor_liquido < ct.valor AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
UNION ALL
 -- 4) gateway_cash_movements (Asaas Créditos e Taxas com valor bruto correto e cascata para galeria/sessão)
 SELECT gm.id::text AS id,
    gm.movement_date AS data,
    COALESCE(cs.data_sessao, gm.movement_date) AS data_competencia,
    CASE WHEN gm.amount >= 0 THEN 'entrada'::text ELSE 'saida'::text END AS tipo,
    COALESCE(NULLIF(TRIM(gm.description), ''), CASE WHEN gm.amount >= 0 THEN 'Crédito Gateway' ELSE 'Débito/Taxa Gateway' END) AS descricao,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
        WHEN c.galeria_id IS NOT NULL OR c.finalidade = 'fotos_extras'::text THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    COALESCE(cl.nome, cl_gal.nome, cl_sess.nome, 'Cliente') AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    CASE WHEN gm.movement_type IN ('fee', 'refund', 'chargeback') THEN 'Despesas de Gateway' ELSE 'Receita de Serviços' END AS categoria,
    cp.numero_parcela AS parcela_atual,
    c.total_parcelas AS parcela_total,
    CASE
      WHEN gm.movement_type = 'credit' AND cp.taxa_gateway > 0 THEN COALESCE(cp.valor_principal, cp.valor_bruto, ABS(gm.amount) + cp.taxa_gateway)
      ELSE ABS(gm.amount)
    END AS valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    c.user_id,
    COALESCE(c.session_id, g.session_id, cs.session_id) AS session_id,
    gm.created_at,
    gm.provider AS meio_pagamento,
    CASE WHEN gm.amount >= 0 THEN 'receita'::text ELSE 'taxa_gateway'::text END AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN c.finalidade = 'fotos_extras'::text THEN 'fotos_extras'::text
        WHEN c.finalidade = 'sessao_e_extras'::text THEN 'sessao_e_extras'::text
        WHEN c.descricao ~* '(sinal|entrada|arras|reserva)'::text OR c.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN c.finalidade IS NOT NULL THEN c.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM gateway_cash_movements gm
     JOIN cobrancas c ON c.id = gm.cobranca_id
     LEFT JOIN cobranca_parcelas cp ON cp.id = gm.parcela_id
     LEFT JOIN galerias g ON g.id = c.galeria_id
     LEFT JOIN clientes cl ON c.cliente_id = cl.id
     LEFT JOIN clientes cl_gal ON g.cliente_id = cl_gal.id
     LEFT JOIN clientes_sessoes cs ON (
       (c.session_id IS NOT NULL AND (c.session_id = cs.session_id OR c.session_id = cs.id::text))
       OR (g.session_id IS NOT NULL AND (g.session_id = cs.session_id OR g.session_id = cs.id::text))
       OR (c.galeria_id IS NOT NULL AND c.galeria_id = cs.galeria_id)
     ) AND c.user_id = cs.user_id
     LEFT JOIN clientes cl_sess ON cs.cliente_id = cl_sess.id
UNION ALL
 -- 5) fin_transactions (Receita extra manual)
 SELECT ft.id::text AS id,
    ft.data_vencimento AS data,
    COALESCE(ft.data_competencia, ft.data_vencimento) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(fim.nome, 'Item desconhecido'::text) AS descricao,
    'financeiro'::text AS origem,
    NULL::text AS cliente,
    NULL::text AS projeto,
    NULL::text AS categoria_session,
    fim.grupo_principal AS categoria,
    ft.parcela_atual,
    ft.parcela_total,
    ft.valor,
    ft.status,
    NULL::text AS cartao,
    ft.observacoes,
    ft.user_id,
    NULL::text AS session_id,
    ft.created_at,
    NULL::text AS meio_pagamento,
    'receita_fin'::text AS natureza,
    NULL::text AS escopo
   FROM fin_transactions ft
     JOIN fin_items_master fim ON ft.item_id = fim.id
  WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
 -- 6) fin_transactions (Despesas)
 SELECT ft.id::text AS id,
    ft.data_vencimento AS data,
    COALESCE(ft.data_competencia, ft.data_vencimento) AS data_competencia,
    'saida'::text AS tipo,
    COALESCE(fim.nome, 'Item desconhecido'::text) AS descricao,
    CASE
        WHEN ft.credit_card_id IS NOT NULL THEN 'cartao'::text
        ELSE 'financeiro'::text
    END AS origem,
    NULL::text AS cliente,
    NULL::text AS projeto,
    NULL::text AS categoria_session,
    fim.grupo_principal AS categoria,
    ft.parcela_atual,
    ft.parcela_total,
    ft.valor,
    ft.status,
    fcc.nome AS cartao,
    ft.observacoes,
    ft.user_id,
    NULL::text AS session_id,
    ft.created_at,
    NULL::text AS meio_pagamento,
    'despesa'::text AS natureza,
    NULL::text AS escopo
   FROM fin_transactions ft
     JOIN fin_items_master fim ON ft.item_id = fim.id
     LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id
  WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
 -- 7) clientes_sessoes (Saldo pendente projetado)
 SELECT
    'cs_' || cs.id::text AS id,
    cs.data_sessao AS data,
    cs.data_sessao AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
    CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text ELSE 'workflow'::text END AS origem,
    c.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    NULL::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    GREATEST((cs.valor_total - COALESCE(cs.valor_pago, 0)), 0) AS valor,
    'Faturado'::text AS status,
    NULL::text AS cartao,
    cs.observacoes AS observacoes,
    cs.user_id,
    cs.session_id,
    cs.created_at,
    NULL::text AS meio_pagamento,
    'saldo_pendente'::text AS natureza,
    CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text ELSE 'sessao'::text END AS escopo
  FROM clientes_sessoes cs
  LEFT JOIN clientes c ON cs.cliente_id = c.id
  WHERE cs.valor_total > COALESCE(cs.valor_pago, 0)
    AND (cs.status IS NULL OR cs.status <> 'cancelado');

GRANT SELECT ON public.extrato_unificado TO authenticated;
GRANT SELECT ON public.extrato_unificado TO anon;


-- 4. Atualizar as RPCs workflow_month_metrics e workflow_range_metrics
CREATE OR REPLACE FUNCTION public.workflow_month_metrics(p_user_id uuid, p_start date, p_end date)
 RETURNS TABLE(previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sess AS (
    SELECT id, session_id,
           COALESCE(valor_total, 0) AS valor_total,
           COALESCE(valor_pago, 0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow', 'venda_avulsa'))
       AND (status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_agg AS (
    SELECT
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess
  ),
  cred_ger AS (
    SELECT COALESCE(SUM(l.valor), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess s
        ON s.session_id = l.session_id_origem
        OR s.id::text   = l.session_id_origem
     WHERE l.user_id = p_user_id
       AND l.valor > 0
  ),
  cred_uso AS (
    SELECT COALESCE(SUM(ABS(l.valor)), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess s
        ON s.session_id = l.session_id_consumo
        OR s.id::text   = l.session_id_consumo
     WHERE l.user_id = p_user_id
  ),
  caixa_tx AS (
    SELECT
      CASE
        WHEN t.tipo = 'pagamento' THEN t.valor
        WHEN t.tipo = 'estorno'   THEN -t.valor
        ELSE 0
      END AS v
    FROM public.clientes_transacoes t
    WHERE t.user_id = p_user_id
      AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
      AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
      AND t.data_transacao BETWEEN p_start AND p_end
  ),
  caixa_gw AS (
    SELECT gm.amount AS v
    FROM public.gateway_cash_movements gm
    JOIN public.cobrancas c ON c.id = gm.cobranca_id
    WHERE c.user_id = p_user_id
      AND gm.movement_type IN ('credit', 'refund', 'chargeback')
      AND gm.movement_date::date BETWEEN p_start AND p_end
  ),
  caixa_combined AS (
    SELECT v FROM caixa_tx
    UNION ALL
    SELECT v FROM caixa_gw
  ),
  caixa AS (
    SELECT COALESCE(SUM(v), 0) AS v FROM caixa_combined
  )
  SELECT sa.previsto, sa.receita, sa.pendente, sa.sessoes,
         cg.v, cu.v, cx.v
    FROM sess_agg sa, cred_ger cg, cred_uso cu, caixa cx;
$function$;

CREATE OR REPLACE FUNCTION public.workflow_range_metrics(p_user_id uuid, p_start date, p_end date, p_granularity text DEFAULT 'month'::text, p_include_historico boolean DEFAULT false)
 RETURNS TABLE(bucket_key text, bucket_start date, previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gran text := lower(coalesce(p_granularity, 'month'));
BEGIN
  IF p_end < p_start THEN
    RAISE EXCEPTION 'end date must be >= start date';
  END IF;
  IF (p_end - p_start) > 400 THEN
    RAISE EXCEPTION 'range too large: max 400 days';
  END IF;
  IF v_gran NOT IN ('day', 'month', 'quarter', 'year', 'total') THEN
    RAISE EXCEPTION 'invalid granularity: %', v_gran;
  END IF;

  RETURN QUERY
  WITH sess AS (
    SELECT id, session_id, data_sessao,
           COALESCE(valor_total, 0) AS valor_total,
           COALESCE(valor_pago, 0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow', 'venda_avulsa'))
       AND (p_include_historico OR status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_bucketed AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(data_sessao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', data_sessao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', data_sessao), 'YYYY') || '-Q' || extract(quarter FROM data_sessao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', data_sessao), 'YYYY')
      END AS bkey,
      CASE
        WHEN v_gran = 'total' THEN p_start
        WHEN v_gran = 'day'   THEN data_sessao
        WHEN v_gran = 'month' THEN date_trunc('month', data_sessao)::date
        WHEN v_gran = 'quarter' THEN date_trunc('quarter', data_sessao)::date
        WHEN v_gran = 'year'  THEN date_trunc('year', data_sessao)::date
      END AS bstart,
      valor_total, valor_pago, id, session_id
    FROM sess
  ),
  sess_agg AS (
    SELECT
      bkey, bstart,
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess_bucketed
    GROUP BY bkey, bstart
  ),
  cred_ger AS (
    SELECT sb.bkey, COALESCE(SUM(l.valor), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess_bucketed sb
        ON sb.session_id = l.session_id_origem
        OR sb.id::text   = l.session_id_origem
     WHERE l.user_id = p_user_id
       AND l.valor > 0
     GROUP BY sb.bkey
  ),
  cred_uso AS (
    SELECT sb.bkey, COALESCE(SUM(ABS(l.valor)), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess_bucketed sb
        ON sb.session_id = l.session_id_consumo
        OR sb.id::text   = l.session_id_consumo
     WHERE l.user_id = p_user_id
     GROUP BY sb.bkey
  ),
  caixa_raw AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(t.data_transacao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', t.data_transacao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', t.data_transacao), 'YYYY') || '-Q' || extract(quarter FROM t.data_transacao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', t.data_transacao), 'YYYY')
      END AS bkey,
      CASE t.tipo
        WHEN 'pagamento' THEN t.valor
        WHEN 'estorno'   THEN -t.valor
        ELSE 0
      END AS v
    FROM public.clientes_transacoes t
    WHERE t.user_id = p_user_id
      AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
      AND (t.dados_extras->>'migrado_para_gateway' IS NULL OR t.dados_extras->>'migrado_para_gateway' != 'true')
      AND t.data_transacao BETWEEN p_start AND p_end
    UNION ALL
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(gm.movement_date::date, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', gm.movement_date::date), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', gm.movement_date::date), 'YYYY') || '-Q' || extract(quarter FROM gm.movement_date::date)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', gm.movement_date::date), 'YYYY')
      END AS bkey,
      gm.amount AS v
    FROM public.gateway_cash_movements gm
    JOIN public.cobrancas c ON c.id = gm.cobranca_id
    WHERE c.user_id = p_user_id
      AND gm.movement_type IN ('credit', 'refund', 'chargeback')
      AND gm.movement_date::date BETWEEN p_start AND p_end
  ),
  caixa AS (
    SELECT bkey, COALESCE(SUM(v), 0) AS v FROM caixa_raw GROUP BY bkey
  )
  SELECT
    sa.bkey,
    sa.bstart,
    sa.previsto,
    sa.receita,
    sa.pendente,
    sa.sessoes,
    COALESCE(cg.v, 0),
    COALESCE(cu.v, 0),
    COALESCE(cx.v, 0)
  FROM sess_agg sa
  LEFT JOIN cred_ger cg ON cg.bkey = sa.bkey
  LEFT JOIN cred_uso cu ON cu.bkey = sa.bkey
  LEFT JOIN caixa    cx ON cx.bkey = sa.bkey
  ORDER BY sa.bstart;
END;
$function$;


-- 5. Reconciliação retroativa de todas as cobranças de extras já pagas
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Processar finalize_gallery_payment para cada cobrança paga de extras
  FOR r IN 
    SELECT c.id, c.data_pagamento, c.metodo_manual, c.obs_manual, c.ip_receipt_url
    FROM public.cobrancas c
    WHERE c.finalidade IN ('fotos_extras', 'sessao_e_extras')
      AND c.status IN ('pago', 'pago_manual')
    ORDER BY c.created_at ASC
  LOOP
    BEGIN
      PERFORM public.finalize_gallery_payment(
        r.id,
        COALESCE(r.data_pagamento, now()),
        r.metodo_manual,
        r.obs_manual,
        r.ip_receipt_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha na reconciliação retroativa da cobrança %: %', r.id, SQLERRM;
    END;
  END LOOP;

  -- Recomputar todos os valores pagos e totais das sessões
  PERFORM public.fix_all_valor_pago();
END;
$$;
