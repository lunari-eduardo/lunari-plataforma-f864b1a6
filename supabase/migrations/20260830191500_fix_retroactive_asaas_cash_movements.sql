-- ==============================================================================
-- Migration: fix_retroactive_asaas_cash_movements
-- Description: Insere movimentos de gateway retroativos para cobranças do Asaas pagas
-- que caíram no limbo após a implementação da Fase 4.
-- ==============================================================================

INSERT INTO public.gateway_cash_movements (
  provider,
  provider_transaction_id,
  cobranca_id,
  parcela_id,
  movement_type,
  amount,
  movement_date,
  description
)
SELECT 
  'asaas' AS provider,
  'payment_' || p.asaas_payment_id || '_credit' AS provider_transaction_id,
  p.cobranca_id,
  p.id AS parcela_id,
  'credit' AS movement_type,
  COALESCE(p.valor_liquido, COALESCE(p.valor_principal, p.valor_bruto)) AS amount,
  COALESCE(p.data_credito, p.data_pagamento, p.updated_at) AS movement_date,
  'Crédito de pagamento ' || p.asaas_payment_id AS description
FROM public.cobranca_parcelas p
JOIN public.cobrancas c ON c.id = p.cobranca_id
WHERE c.provedor = 'asaas'
  AND p.status IN ('confirmado', 'recebido', 'antecipado')
  -- Apenas se não existir (idempotência)
  AND NOT EXISTS (
    SELECT 1 FROM public.gateway_cash_movements g 
    WHERE g.provider = 'asaas' 
      AND g.provider_transaction_id = 'payment_' || p.asaas_payment_id || '_credit'
  );

INSERT INTO public.gateway_cash_movements (
  provider,
  provider_transaction_id,
  cobranca_id,
  parcela_id,
  movement_type,
  amount,
  movement_date,
  description
)
SELECT 
  'asaas' AS provider,
  'payment_' || p.asaas_payment_id || '_fee' AS provider_transaction_id,
  p.cobranca_id,
  p.id AS parcela_id,
  'fee' AS movement_type,
  -p.taxa_gateway AS amount,
  COALESCE(p.data_credito, p.data_pagamento, p.updated_at) AS movement_date,
  'Taxa de processamento ' || p.asaas_payment_id AS description
FROM public.cobranca_parcelas p
JOIN public.cobrancas c ON c.id = p.cobranca_id
WHERE c.provedor = 'asaas'
  AND p.status IN ('confirmado', 'recebido', 'antecipado')
  AND p.taxa_gateway > 0
  -- Apenas se não existir (idempotência)
  AND NOT EXISTS (
    SELECT 1 FROM public.gateway_cash_movements g 
    WHERE g.provider = 'asaas' 
      AND g.provider_transaction_id = 'payment_' || p.asaas_payment_id || '_fee'
  );

