-- 1. Add optional data_competencia column to fin_transactions
ALTER TABLE public.fin_transactions
ADD COLUMN IF NOT EXISTS data_competencia DATE;

COMMENT ON COLUMN public.fin_transactions.data_competencia IS 'Data de competência (regime contábil). Quando NULL, usa data_vencimento como fallback.';

-- 2. Recreate extrato_unificado view with data_competencia column
DROP VIEW IF EXISTS public.extrato_unificado;

CREATE VIEW public.extrato_unificado AS
-- Pagamentos de sessões (entradas)
SELECT 
  ct.id::text AS id,
  ct.data_transacao AS data,
  COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
  'entrada'::text AS tipo,
  COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
  CASE
    WHEN cob.galeria_id IS NOT NULL THEN 'gallery'::text
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
FROM public.clientes_transacoes ct
LEFT JOIN public.clientes c ON ct.cliente_id = c.id
LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN public.cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text

UNION ALL

-- Estornos (saídas)
SELECT 
  ct.id::text AS id,
  ct.data_transacao AS data,
  COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
  'saida'::text AS tipo,
  COALESCE(regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]'::text, ''::text, 'g'::text), 'Estorno'::text) AS descricao,
  'workflow'::text AS origem,
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
FROM public.clientes_transacoes ct
LEFT JOIN public.clientes c ON ct.cliente_id = c.id
LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
WHERE ct.tipo = 'estorno'::text

UNION ALL

-- Receitas avulsas (fin_transactions)
SELECT 
  ft.id::text AS id,
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
FROM public.fin_transactions ft
JOIN public.fin_items_master fim ON ft.item_id = fim.id
WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])

UNION ALL

-- Despesas avulsas (fin_transactions)
SELECT 
  ft.id::text AS id,
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
FROM public.fin_transactions ft
JOIN public.fin_items_master fim ON ft.item_id = fim.id
LEFT JOIN public.fin_credit_cards fcc ON ft.credit_card_id = fcc.id
WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])

UNION ALL

-- Taxas de gateway (saídas atreladas a pagamentos)
SELECT 
  ct.id::text || '_taxa'::text AS id,
  ct.data_transacao AS data,
  COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
  'saida'::text AS tipo,
  'Taxa Gateway / Antecipação'::text AS descricao,
  CASE
    WHEN cob.galeria_id IS NOT NULL THEN 'gallery'::text
    ELSE 'workflow'::text
  END AS origem,
  c.nome AS cliente,
  cs.pacote AS projeto,
  cs.categoria AS categoria_session,
  'Taxas de Gateway'::text AS categoria,
  NULL::integer AS parcela_atual,
  NULL::integer AS parcela_total,
  COALESCE(ct.taxa_gateway, 0::numeric) + COALESCE(ct.taxa_antecipacao, 0::numeric) AS valor,
  'Pago'::text AS status,
  NULL::text AS cartao,
  NULL::text AS observacoes,
  ct.user_id,
  ct.session_id,
  ct.created_at,
  COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento
FROM public.clientes_transacoes ct
LEFT JOIN public.clientes c ON ct.cliente_id = c.id
LEFT JOIN public.clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN public.cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'::text 
  AND (COALESCE(ct.taxa_gateway, 0::numeric) + COALESCE(ct.taxa_antecipacao, 0::numeric)) > 0::numeric;

-- Grant access to the view (matches RLS of underlying tables)
GRANT SELECT ON public.extrato_unificado TO authenticated;