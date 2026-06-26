
-- 1) Backfill galeria_id nas cobranças órfãs de fotos_extras
UPDATE cobrancas cob
SET galeria_id = sub.galeria_id
FROM (
  SELECT cob.id AS cob_id, g.id AS galeria_id
  FROM cobrancas cob
  JOIN galerias g
    ON g.user_id = cob.user_id
   AND (g.session_id = cob.session_id OR g.cliente_id = cob.cliente_id)
  WHERE cob.finalidade = 'fotos_extras'
    AND cob.galeria_id IS NULL
  GROUP BY cob.id, g.id
) sub
WHERE cob.id = sub.cob_id
  AND cob.galeria_id IS NULL
  AND (SELECT COUNT(*) FROM galerias g2
       WHERE g2.user_id = cob.user_id
         AND (g2.session_id = cob.session_id OR g2.cliente_id = cob.cliente_id)) = 1;

-- 2) Recriar view extrato_unificado com regra robusta para identificar Gallery
CREATE OR REPLACE VIEW public.extrato_unificado AS
SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL
          OR cob.finalidade = 'fotos_extras'
          OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)')
          THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    c.nome AS cliente,
    cs.pacote AS projeto,
    cs.categoria AS categoria_session,
    NULL::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text
UNION ALL
SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    COALESCE(regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]'::text, ''::text, 'g'::text), 'Estorno'::text) AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL
          OR cob.finalidade = 'fotos_extras'
          OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)')
          THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    c.nome AS cliente,
    cs.pacote AS projeto,
    cs.categoria AS categoria_session,
    'Estorno'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    COALESCE(regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]'::text, ''::text, 'g'::text), 'Estorno'::text) AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    'estorno'::text AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'estorno'::text
UNION ALL
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
    NULL::text AS meio_pagamento
FROM fin_transactions ft
JOIN fin_items_master fim ON ft.item_id = fim.id
WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
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
    NULL::text AS meio_pagamento
FROM fin_transactions ft
JOIN fin_items_master fim ON ft.item_id = fim.id
LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id
WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
SELECT ct.id::text || '_taxa'::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    'Taxa Gateway / Antecipação'::text AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras' THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    c.nome AS cliente,
    cs.pacote AS projeto,
    cs.categoria AS categoria_session,
    'Taxas de Gateway'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    (ct.valor - COALESCE(ct.valor_liquido, ct.valor))::numeric AS valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text
  AND ct.valor_liquido IS NOT NULL
  AND ct.valor_liquido < ct.valor;
