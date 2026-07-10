-- Recria a view extrato_unificado removendo:
--  1. UUID da cobrança do texto de estornos ("(cobranca xxxxxxxx-xxxx-...)")
--  2. Sufixos herdados do pagamento original que ficam redundantes no estorno
--     (provedor, "InfinitePay", "MercadoPago", etc. já ficam implícitos)
--  3. Duplicação: observacoes deixa de repetir descricao no braço de clientes_transacoes

DROP VIEW IF EXISTS public.extrato_unificado;

CREATE VIEW public.extrato_unificado
WITH (security_invoker=on) AS
-- Entradas: pagamentos
SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
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
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento,
    'pagamento'::text AS natureza
FROM clientes_transacoes ct
    LEFT JOIN clientes c ON ct.cliente_id = c.id
    LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
    LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text
UNION ALL
-- Saídas: estornos (descrição enxuta, sem UUID; observacoes NULL para não duplicar)
SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    COALESCE(
      NULLIF(
        btrim(
          regexp_replace(
            regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]'::text, ''::text, 'g'),
            '\s*\(cobranca [0-9a-fA-F-]+\)\s*'::text, ' '::text, 'g'
          )
        ),
        ''
      ),
      'Estorno'::text
    ) AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
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
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    'estorno'::text AS meio_pagamento,
    'estorno'::text AS natureza
FROM clientes_transacoes ct
    LEFT JOIN clientes c ON ct.cliente_id = c.id
    LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
    LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'estorno'::text
UNION ALL
-- Receitas financeiras
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
    'receita_fin'::text AS natureza
FROM fin_transactions ft
    JOIN fin_items_master fim ON ft.item_id = fim.id
WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
-- Despesas financeiras
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
    'despesa'::text AS natureza
FROM fin_transactions ft
    JOIN fin_items_master fim ON ft.item_id = fim.id
    LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id
WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
-- Taxas de gateway
SELECT ct.id::text || '_taxa'::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    'Taxa Gateway / Antecipação'::text AS descricao,
    CASE
        WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text THEN 'gallery'::text
        ELSE 'workflow'::text
    END AS origem,
    c.nome AS cliente,
    cs.pacote AS projeto,
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
    'taxa_gateway'::text AS natureza
FROM clientes_transacoes ct
    LEFT JOIN clientes c ON ct.cliente_id = c.id
    LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
    LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text AND ct.valor_liquido IS NOT NULL AND ct.valor_liquido < ct.valor;

COMMENT ON VIEW public.extrato_unificado IS 'View unificada (security_invoker) — estornos exibem descrição enxuta sem UUID de cobrança e sem duplicar em observacoes';

-- Backfill: limpa também o registro em clientes_transacoes para manter consistência
-- em qualquer outra consulta que use ct.descricao diretamente.
UPDATE public.clientes_transacoes
SET descricao = btrim(regexp_replace(descricao, '\s*\(cobranca [0-9a-fA-F-]+\)\s*', ' ', 'g'))
WHERE tipo = 'estorno'
  AND descricao ~ 'cobranca [0-9a-fA-F-]+';
