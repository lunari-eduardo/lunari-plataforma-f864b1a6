-- ==============================================================================
-- Migration: 20260828183227_financeiro_fase4.sql
-- Fase 4: Corte Financeiro
-- - Interrompe geração de clientes_transacoes para pagamentos do Asaas
-- - Atualiza recompute_session_paid para somar também parcelas do Asaas
-- - Inclui gateway_cash_movements no extrato financeiro unificado
-- ==============================================================================

-- 1. Modificar ensure_transaction_on_cobranca_paid para ignorar 'asaas'
CREATE OR REPLACE FUNCTION public.ensure_transaction_on_cobranca_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_text TEXT;
  v_cliente_id UUID;
  v_existing_tx UUID;
  v_valor_transacao NUMERIC;
  v_valor_liquido NUMERIC;
  v_taxa_gateway NUMERIC;
  v_taxa_antecipacao NUMERIC;
  v_provedor_label TEXT;
  v_finalidade TEXT;
  v_is_extras BOOLEAN;
  v_is_combined BOOLEAN;
  v_is_sinal BOOLEAN;
  v_galeria_session_id TEXT;
  v_repassar_processamento BOOLEAN;
  v_repassar_antecipacao BOOLEAN;
  v_custom_desc TEXT;
  v_valor_base NUMERIC;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN
    
    -- FASE 4: O Asaas agora tem seu próprio fluxo no razão de gateway (gateway_cash_movements).
    -- Ignoramos a criação de clientes_transacoes se for Asaas.
    IF NEW.provedor = 'asaas' THEN
      RETURN NEW;
    END IF;

    v_finalidade := COALESCE(NEW.finalidade, 'sessao');
    v_is_extras   := (v_finalidade = 'fotos_extras');
    v_is_combined := (v_finalidade = 'sessao_e_extras');
    v_is_sinal    := (v_finalidade = 'sinal' OR COALESCE(NEW.descricao, '') ~* '(sinal|entrada|arras|reserva)');

    v_valor_base := NULL;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'valorBase') IS NOT NULL THEN
      v_valor_base := (NEW.dados_extras->>'valorBase')::NUMERIC;
    END IF;

    v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
    v_repassar_antecipacao := COALESCE((NEW.dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
    END IF;

    v_valor_transacao := COALESCE(v_valor_base, NEW.valor);
    
    IF v_repassar_processamento AND v_repassar_antecipacao THEN
      v_taxa_gateway := 0;
      v_taxa_antecipacao := 0;
      v_valor_liquido := v_valor_transacao;
    ELSIF v_repassar_processamento THEN
      v_taxa_gateway := 0;
      IF v_taxa_antecipacao > 0 THEN
        v_valor_liquido := GREATEST(0, v_valor_transacao - v_taxa_antecipacao);
      ELSE
        v_valor_liquido := v_valor_transacao;
      END IF;
    ELSE
      IF NEW.valor_liquido IS NOT NULL AND NEW.valor_liquido > 0 AND NEW.valor_liquido < v_valor_transacao THEN
        v_valor_liquido := NEW.valor_liquido;
        v_taxa_gateway := GREATEST(0, ROUND(v_valor_transacao - v_valor_liquido, 2));
        IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
          v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
        END IF;
      ELSE
        v_valor_liquido := v_valor_transacao;
        v_taxa_gateway := 0;
      END IF;
    END IF;

    IF NEW.session_id IS NOT NULL THEN
      SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
      FROM public.clientes_sessoes
      WHERE session_id = NEW.session_id OR id::text = NEW.session_id
      LIMIT 1;
    END IF;

    IF v_session_text IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT session_id INTO v_galeria_session_id
      FROM public.galerias
      WHERE id = NEW.galeria_id
      LIMIT 1;

      IF v_galeria_session_id IS NOT NULL THEN
        SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
        FROM public.clientes_sessoes
        WHERE session_id = v_galeria_session_id OR id::text = v_galeria_session_id
        LIMIT 1;
      END IF;
    END IF;

    IF v_cliente_id IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT cliente_id INTO v_cliente_id
      FROM public.galerias
      WHERE id = NEW.galeria_id
      LIMIT 1;
    END IF;

    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;

    IF v_cliente_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE cobranca_id = NEW.id
    LIMIT 1;

    IF v_existing_tx IS NULL THEN
      SELECT id INTO v_existing_tx
      FROM public.clientes_transacoes
      WHERE tipo = 'pagamento'
        AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
      LIMIT 1;
    END IF;

    v_provedor_label := CASE
      WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.provedor = 'manual' THEN COALESCE(NEW.metodo_manual, 'Manual')
      ELSE COALESCE(NEW.provedor, 'manual')
    END;

    v_custom_desc := COALESCE(NULLIF(TRIM(NEW.descricao), ''), '');

    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao,
        tipo, data_transacao, descricao, cobranca_id
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento, NOW()),
        CASE
          WHEN v_is_combined THEN 'Sessão + fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          WHEN v_is_extras   THEN 'Fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          WHEN v_is_sinal    THEN 'Sinal ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')' || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          ELSE 'Pagamento ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')' || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
        END,
        NEW.id
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET
        valor = v_valor_transacao,
        valor_liquido = v_valor_liquido,
        taxa_gateway = v_taxa_gateway,
        taxa_antecipacao = v_taxa_antecipacao,
        data_transacao = COALESCE(NEW.data_pagamento, data_transacao)
      WHERE id = v_existing_tx;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- 2. Atualizar rotinas de valor_pago
CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_soma_tx NUMERIC := 0;
  v_soma_parcelas NUMERIC := 0;
BEGIN
  -- 1) Soma das transacoes manuais e de gateways antigos/legados
  SELECT COALESCE(SUM(CASE WHEN tipo = 'estorno' THEN -valor ELSE valor END), 0)
  INTO v_soma_tx
  FROM public.clientes_transacoes ct
  LEFT JOIN public.cobrancas c ON ct.cobranca_id = c.id
  WHERE ct.session_id = p_session_id 
    AND ct.tipo IN ('pagamento', 'estorno')
    AND (c.provedor IS DISTINCT FROM 'asaas' OR ct.dados_extras->>'migrado_para_gateway' IS NULL);

  -- 2) Soma do valor principal (ou nominal) quitado nas parcelas do Asaas
  SELECT COALESCE(SUM(COALESCE(cp.valor_principal, cp.valor_bruto)), 0)
  INTO v_soma_parcelas
  FROM public.cobranca_parcelas cp
  JOIN public.cobrancas c ON c.id = cp.cobranca_id
  WHERE (c.session_id = p_session_id OR c.galeria_id IN (SELECT id FROM public.galerias WHERE session_id = p_session_id))
    AND c.provedor = 'asaas'
    AND cp.status IN ('confirmado', 'recebido', 'antecipado');

  UPDATE public.clientes_sessoes
  SET 
    valor_pago = v_soma_tx + v_soma_parcelas,
    updated_at = NOW()
  WHERE session_id = p_session_id OR id::text = p_session_id;
  
  RAISE NOTICE 'Recalculado valor_pago para session_id: %, total=%', p_session_id, (v_soma_tx + v_soma_parcelas);
END;
$function$;

-- Update para a versao bulk tb
CREATE OR REPLACE FUNCTION public.fix_all_valor_pago()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_fixed INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT id, session_id FROM clientes_sessoes LOOP
    PERFORM public.recompute_session_paid(r.session_id);
    v_fixed := v_fixed + 1;
  END LOOP;
  RETURN v_fixed;
END;
$function$;


-- 3. Atualizar extrato_unificado para consumir gateway_cash_movements
-- (Mantém todo o resto, apenas adiciona o cash_movements e filtra as txs Asaas migradas/novas)
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
            WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
            ELSE 'workflow'::text
        END AS origem,
    c.nome AS cliente,
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
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
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
            WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
            ELSE 'workflow'::text
        END AS origem,
    c.nome AS cliente,
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
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
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
    c.nome AS cliente,
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
    NULL::text AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
  WHERE ct.tipo = 'pagamento'::text AND ct.valor_liquido IS NOT NULL AND ct.valor_liquido < ct.valor AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
UNION ALL
 -- 4) NOVA FASE 4: gateway_cash_movements (Asaas Créditos e Taxas)
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
    cl.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    CASE WHEN gm.movement_type IN ('fee', 'refund', 'chargeback') THEN 'Despesas de Gateway' ELSE 'Receita de Serviços' END AS categoria,
    cp.numero_parcela AS parcela_atual,
    c.total_parcelas AS parcela_total,
    ABS(gm.amount) AS valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    c.user_id,
    c.session_id,
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
     LEFT JOIN clientes cl ON c.cliente_id = cl.id
     LEFT JOIN clientes_sessoes cs ON c.session_id = cs.session_id AND c.user_id = cs.user_id
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
