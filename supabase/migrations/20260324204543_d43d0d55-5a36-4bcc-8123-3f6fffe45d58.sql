
-- 1. Insert missing transactions ONLY for cobrancas whose session exists
INSERT INTO public.clientes_transacoes (
  user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao, tipo, data_transacao, descricao
)
SELECT
  c.user_id,
  COALESCE(cs.cliente_id, c.cliente_id),
  c.session_id,
  c.valor,
  c.valor_liquido,
  CASE 
    WHEN c.valor_liquido IS NOT NULL AND c.valor_liquido > 0 
    THEN ROUND(c.valor - c.valor_liquido, 2)
    ELSE 0
  END,
  0,
  'pagamento',
  COALESCE(c.data_pagamento::date, CURRENT_DATE),
  FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]',
    CASE
      WHEN c.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN c.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN c.provedor = 'asaas' THEN 'Asaas'
      ELSE COALESCE(c.provedor, 'manual')
    END,
    c.id,
    CASE WHEN c.descricao IS NOT NULL THEN ' - ' || c.descricao ELSE '' END
  )
FROM cobrancas c
INNER JOIN clientes_sessoes cs ON cs.session_id = c.session_id
WHERE c.status IN ('pago', 'pago_manual')
  AND c.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_transacoes ct
    WHERE ct.tipo = 'pagamento'
      AND ct.descricao ILIKE '%cobranca ' || c.id::text || '%'
  );

-- 2. Also insert orphan transactions (session deleted) without session_id
INSERT INTO public.clientes_transacoes (
  user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao, tipo, data_transacao, descricao
)
SELECT
  c.user_id,
  COALESCE(c.cliente_id, (SELECT g.cliente_id FROM galerias g WHERE g.id = c.galeria_id LIMIT 1)),
  NULL,
  c.valor,
  c.valor_liquido,
  CASE 
    WHEN c.valor_liquido IS NOT NULL AND c.valor_liquido > 0 
    THEN ROUND(c.valor - c.valor_liquido, 2)
    ELSE 0
  END,
  0,
  'pagamento',
  COALESCE(c.data_pagamento::date, CURRENT_DATE),
  FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled][orphan]',
    CASE
      WHEN c.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN c.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN c.provedor = 'asaas' THEN 'Asaas'
      ELSE COALESCE(c.provedor, 'manual')
    END,
    c.id,
    CASE WHEN c.descricao IS NOT NULL THEN ' - ' || c.descricao ELSE '' END
  )
FROM cobrancas c
WHERE c.status IN ('pago', 'pago_manual')
  AND c.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_sessoes cs WHERE cs.session_id = c.session_id
  )
  AND c.cliente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_transacoes ct
    WHERE ct.tipo = 'pagamento'
      AND ct.descricao ILIKE '%cobranca ' || c.id::text || '%'
  );

-- 3. Update trigger to also fire on INSERT (preventive fix)
DROP TRIGGER IF EXISTS ensure_tx_on_cobranca_paid ON cobrancas;
CREATE TRIGGER ensure_tx_on_cobranca_paid
  AFTER INSERT OR UPDATE ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION ensure_transaction_on_cobranca_paid();
