-- ============================================================
-- MIGRATION: EXTRATO UNIFICADO VIEW
-- Cria uma view para unificar receitas e despesas em um único extrato
-- ============================================================

-- VIEW: extrato_unificado
-- Combina pagamentos (receitas) e transações financeiras (despesas)
CREATE OR REPLACE VIEW extrato_unificado AS
-- RECEITAS (Pagamentos de clientes)
SELECT 
  ct.id,
  ct.data_transacao as data,
  'entrada'::text as tipo,
  COALESCE(c.nome, 'Cliente desconhecido') as descricao,
  'workflow'::text as origem,
  c.nome as cliente,
  cs.pacote as projeto,
  cs.categoria as categoria_session,
  NULL::text as categoria,
  NULL::integer as parcela_atual,
  NULL::integer as parcela_total,
  ct.valor,
  'Pago'::text as status,
  NULL::text as cartao,
  NULL::text as observacoes,
  ct.user_id,
  ct.session_id,
  ct.created_at
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
WHERE ct.tipo = 'pagamento'

UNION ALL

-- DESPESAS (Transações Financeiras)
SELECT 
  ft.id,
  ft.data_vencimento as data,
  'saida'::text as tipo,
  COALESCE(fim.nome, 'Item desconhecido') as descricao,
  CASE 
    WHEN ft.credit_card_id IS NOT NULL THEN 'cartao'::text
    ELSE 'financeiro'::text
  END as origem,
  NULL::text as cliente,
  NULL::text as projeto,
  NULL::text as categoria_session,
  fim.grupo_principal as categoria,
  ft.parcela_atual,
  ft.parcela_total,
  ft.valor,
  ft.status,
  fcc.nome as cartao,
  ft.observacoes,
  ft.user_id,
  NULL::text as session_id,
  ft.created_at
FROM fin_transactions ft
INNER JOIN fin_items_master fim ON ft.item_id = fim.id
LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id;

-- Comentário da view
COMMENT ON VIEW extrato_unificado IS 'View unificada que combina receitas (clientes_transacoes) e despesas (fin_transactions) para o extrato financeiro';

-- Habilitar realtime na view (para subscriptions)
-- Nota: Views não suportam RLS diretamente, mas herdam as políticas das tabelas base