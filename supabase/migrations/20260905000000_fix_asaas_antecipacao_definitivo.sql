-- ==============================================================================
-- Migration: 20260905000000_fix_asaas_antecipacao_definitivo.sql
-- Correção definitiva da antecipação automática Asaas
-- 1. Garante coluna data_credito_real e índices em cobranca_parcelas
-- 2. Atualiza reconcile_cobranca_from_parcelas para agregar taxa_antecipacao_real e data_credito_real
-- 3. Atualiza a view extrato_unificado para refletir status 'Pago' em movimentos liquidados/antecipados
-- ==============================================================================

-- 1. Schema em cobranca_parcelas
ALTER TABLE public.cobranca_parcelas
  ADD COLUMN IF NOT EXISTS data_credito_real TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cobranca_parcelas_credito_real 
  ON public.cobranca_parcelas(data_credito_real);

-- 2. Atualização de reconcile_cobranca_from_parcelas
CREATE OR REPLACE FUNCTION public.reconcile_cobranca_from_parcelas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_parcelas INTEGER;
  v_parcelas_pagas INTEGER;
  v_total_liquido_creditado NUMERIC;
  v_total_principal_pago NUMERIC;
  v_total_repassado NUMERIC;
  v_total_taxa_proc NUMERIC;
  v_total_taxa_ant NUMERIC;
  v_max_credito_real TIMESTAMPTZ;
  v_min_credito_previsto DATE;
  v_new_status TEXT;
  v_current_status TEXT;
  v_cobranca_valor NUMERIC;
  v_cobranca_principal NUMERIC;
  v_cobranca_cobrado NUMERIC;
BEGIN
  -- 1. Obter dados da cobranca pai
  SELECT total_parcelas, status, valor, valor_principal, valor_cobrado_cliente
  INTO v_total_parcelas, v_current_status, v_cobranca_valor, v_cobranca_principal, v_cobranca_cobrado
  FROM public.cobrancas
  WHERE id = NEW.cobranca_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_total_parcelas := COALESCE(v_total_parcelas, 1);

  -- 2. Consolidar parcelas quitadas/ativas
  SELECT
    COUNT(*) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')),
    COALESCE(SUM(COALESCE(valor_liquido_creditado, valor_liquido, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0),
    COALESCE(SUM(COALESCE(valor_principal, valor_bruto, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0),
    COALESCE(SUM(COALESCE(valor_repassado_cliente, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0),
    COALESCE(SUM(COALESCE(taxa_processamento_real, taxa_gateway, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0),
    COALESCE(SUM(COALESCE(taxa_antecipacao_real, taxa_antecipacao, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0),
    MAX(data_credito_real) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')),
    MIN(data_credito) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado'))
  INTO
    v_parcelas_pagas,
    v_total_liquido_creditado,
    v_total_principal_pago,
    v_total_repassado,
    v_total_taxa_proc,
    v_total_taxa_ant,
    v_max_credito_real,
    v_min_credito_previsto
  FROM public.cobranca_parcelas
  WHERE cobranca_id = NEW.cobranca_id;

  -- 3. Determinar novo status
  IF v_parcelas_pagas >= v_total_parcelas AND v_total_parcelas > 0 THEN
    v_new_status := 'pago';
  ELSIF v_parcelas_pagas > 0 THEN
    v_new_status := 'parcialmente_pago';
  ELSE
    v_new_status := v_current_status;
  END IF;

  -- Respeitar status terminais se já estornado/cancelado
  IF v_current_status IN ('estornado', 'chargeback', 'cancelado') AND v_parcelas_pagas = 0 THEN
    v_new_status := v_current_status;
  END IF;

  -- 4. Atualizar cobranca como autor único
  UPDATE public.cobrancas
  SET
    parcelas_pagas = v_parcelas_pagas,
    valor_liquido = v_total_liquido_creditado,
    valor_liquido_creditado = v_total_liquido_creditado,
    taxa_processamento_real = v_total_taxa_proc,
    taxa_antecipacao_real = v_total_taxa_ant,
    valor_repassado_cliente = v_total_repassado,
    status = v_new_status,
    data_credito_real = COALESCE(v_max_credito_real, data_credito_real),
    data_credito = COALESCE(v_min_credito_previsto, data_credito),
    data_pagamento = CASE WHEN v_new_status = 'pago' AND data_pagamento IS NULL THEN now() ELSE data_pagamento END,
    updated_at = now()
  WHERE id = NEW.cobranca_id;

  RETURN NEW;
END;
$$;

-- 3. Atualização da View extrato_unificado com status robusto para Gateway
CREATE OR REPLACE VIEW public.extrato_unificado WITH (security_invoker=on) AS
   -- 1) clientes_transacoes (Pagamentos manuais / legados - NUNCA Asaas novo)
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
     FROM public.clientes_transacoes ct
       LEFT JOIN public.clientes c ON ct.cliente_id = c.id
       LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
       LEFT JOIN public.cobrancas cob ON cob.id = ct.cobranca_id
    WHERE ct.tipo = 'pagamento'::text 
      AND (cob.provedor IS DISTINCT FROM 'asaas' OR cob.id IS NULL)
      AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
  UNION ALL
   -- 2) clientes_transacoes (Estornos manuais / legados)
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
     FROM public.clientes_transacoes ct
       LEFT JOIN public.clientes c ON ct.cliente_id = c.id
       LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
       LEFT JOIN public.cobrancas cob ON cob.id = ct.cobranca_id
    WHERE ct.tipo = 'estorno'::text 
      AND (cob.provedor IS DISTINCT FROM 'asaas' OR cob.id IS NULL)
      AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
  UNION ALL
   -- 3) clientes_transacoes (Taxas manuais / legadas)
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
     FROM public.clientes_transacoes ct
       LEFT JOIN public.clientes c ON ct.cliente_id = c.id
       LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
       LEFT JOIN public.cobrancas cob ON cob.id = ct.cobranca_id
    WHERE ct.tipo = 'pagamento'::text AND ct.valor_liquido IS NOT NULL AND ct.valor_liquido < ct.valor
      AND (cob.provedor IS DISTINCT FROM 'asaas' OR cob.id IS NULL)
      AND (ct.dados_extras->>'migrado_para_gateway' IS NULL OR ct.dados_extras->>'migrado_para_gateway' != 'true')
  UNION ALL
   -- 4) Razão do Gateway: gateway_cash_movements (Asaas Créditos, Repasses, Taxas e Estornos)
   SELECT gm.id::text AS id,
      gm.movement_date AS data,
      COALESCE(gm.competence_date, cs.data_sessao, gm.movement_date) AS data_competencia,
      CASE WHEN gm.amount >= 0 THEN 'entrada'::text ELSE 'saida'::text END AS tipo,
      COALESCE(NULLIF(TRIM(gm.description), ''), 
        CASE 
          WHEN gm.movement_type = 'pass_through' THEN 'Repasse de Taxa Gateway'
          WHEN gm.amount >= 0 THEN 'Crédito Gateway' 
          ELSE 'Taxa/Débito Gateway' 
        END
      ) AS descricao,
      CASE
          WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
          WHEN c.galeria_id IS NOT NULL OR c.finalidade = 'fotos_extras'::text THEN 'gallery'::text
          ELSE 'workflow'::text
      END AS origem,
      cl.nome AS cliente,
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
      cs.categoria AS categoria_session,
      CASE 
          WHEN gm.movement_type = 'pass_through' THEN 'Repasse de Taxa'
          WHEN gm.movement_type IN ('fee', 'refund', 'chargeback') THEN 'Despesas de Gateway' 
          ELSE 'Receita de Serviços' 
      END AS categoria,
      cp.numero_parcela AS parcela_atual,
      c.total_parcelas AS parcela_total,
      ABS(gm.amount) AS valor,
      -- CORREÇÃO: Se a parcela está confirmada/recebida/antecipada ou a data já passou, o status é Pago!
      CASE 
        WHEN cp.status IN ('confirmado', 'recebido', 'antecipado') OR gm.movement_date::date <= CURRENT_DATE THEN 'Pago'::text 
        ELSE 'Agendado'::text 
      END AS status,
      NULL::text AS cartao,
      NULL::text AS observacoes,
      c.user_id,
      c.session_id,
      gm.created_at,
      gm.provider AS meio_pagamento,
      CASE 
          WHEN gm.movement_type = 'pass_through' THEN 'recuperacao_taxa'::text
          WHEN gm.amount >= 0 THEN 'receita'::text 
          ELSE 'taxa_gateway'::text 
      END AS natureza,
      CASE
          WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
          WHEN c.finalidade = 'fotos_extras'::text THEN 'fotos_extras'::text
          WHEN c.finalidade = 'sessao_e_extras'::text THEN 'sessao_e_extras'::text
          WHEN c.descricao ~* '(sinal|entrada|arras|reserva)'::text OR c.finalidade = 'sinal'::text THEN 'sinal'::text
          WHEN c.finalidade IS NOT NULL THEN c.finalidade
          ELSE 'sessao'::text
      END AS escopo
     FROM public.gateway_cash_movements gm
       JOIN public.cobrancas c ON c.id = gm.cobranca_id
       LEFT JOIN public.cobranca_parcelas cp ON cp.id = gm.parcela_id
       LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
       LEFT JOIN public.clientes_sessoes cs ON c.session_id = cs.session_id AND c.user_id = cs.user_id
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
     FROM public.fin_transactions ft
       JOIN public.fin_items_master fim ON ft.item_id = fim.id
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
     FROM public.fin_transactions ft
       JOIN public.fin_items_master fim ON ft.item_id = fim.id
       LEFT JOIN public.fin_credit_cards fcc ON ft.credit_card_id = fcc.id
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
    FROM public.clientes_sessoes cs
    LEFT JOIN public.clientes c ON cs.cliente_id = c.id
    WHERE cs.valor_total > COALESCE(cs.valor_pago, 0)
      AND (cs.status IS NULL OR cs.status <> 'cancelado');
