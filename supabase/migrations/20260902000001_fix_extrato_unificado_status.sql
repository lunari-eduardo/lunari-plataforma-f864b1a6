CREATE OR REPLACE VIEW public.extrato_unificado WITH (security_invoker=on) AS
   -- 1) clientes_transacoes (Pagamentos nao migrados ou que nǜo sejam Asaas com cash_movements)
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
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessǜo' END) AS projeto,
      cs.categoria AS categoria_session,
      'Receita de Servios'::text AS categoria,
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
          WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ǜoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
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
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessǜo' END) AS projeto,
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
          WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ǜoa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
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
      'Taxa Gateway / Antecipaǜo'::text AS descricao,
          CASE
              WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
              WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text THEN 'gallery'::text
              ELSE 'workflow'::text
          END AS origem,
      c.nome AS cliente,
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessǜo' END) AS projeto,
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
   -- 4) NOVA FASE 4: gateway_cash_movements (Asaas CrǸditos e Taxas)
   SELECT gm.id::text AS id,
      gm.movement_date AS data,
      COALESCE(cs.data_sessao, gm.movement_date) AS data_competencia,
      CASE WHEN gm.amount >= 0 THEN 'entrada'::text ELSE 'saida'::text END AS tipo,
      COALESCE(NULLIF(TRIM(gm.description), ''), CASE WHEN gm.amount >= 0 THEN 'CrǸdito Gateway' ELSE 'DǸbito/Taxa Gateway' END) AS descricao,
          CASE
              WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
              WHEN c.galeria_id IS NOT NULL OR c.finalidade = 'fotos_extras'::text THEN 'gallery'::text
              ELSE 'workflow'::text
          END AS origem,
      cl.nome AS cliente,
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessǜo' END) AS projeto,
      cs.categoria AS categoria_session,
      CASE WHEN gm.movement_type IN ('fee', 'refund', 'chargeback') THEN 'Despesas de Gateway' ELSE 'Receita de Servios' END AS categoria,
      cp.numero_parcela AS parcela_atual,
      c.total_parcelas AS parcela_total,
      ABS(gm.amount) AS valor,
      CASE WHEN gm.movement_date::date > CURRENT_DATE THEN 'Agendado'::text ELSE 'Pago'::text END AS status,
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
    WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Nǜo Operacional'::text, 'Receita Extra'::text])
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
    WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Nǜo Operacional'::text, 'Receita Extra'::text])
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
      COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessǜo' END) AS projeto,
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
