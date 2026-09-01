-- ==============================================================================
-- Migration: 20260902300000_fase5_reconciliacao_historico.sql
-- Fase 5: Backup e Reconciliação Retroativa de Dados Existentes
-- 1. Criação de tabelas de backup
-- 2. Backfill e saneamento de cobrancas e cobranca_parcelas
-- 3. Reconciliação do razão de caixa gateway_cash_movements (Decomposição em 3 linhas)
-- 4. Recálculo consistente de valor_pago nas sessões
-- ==============================================================================

-- 1. Backup de segurança
CREATE TABLE IF NOT EXISTS public.backup_cobrancas_20260902 AS 
SELECT * FROM public.cobrancas;

CREATE TABLE IF NOT EXISTS public.backup_parcelas_20260902 AS 
SELECT * FROM public.cobranca_parcelas;

CREATE TABLE IF NOT EXISTS public.backup_movements_20260902 AS 
SELECT * FROM public.gateway_cash_movements;

-- 2. Backfill e saneamento em cobrancas
UPDATE public.cobrancas c
SET 
  valor_principal = COALESCE(c.valor_principal, (c.dados_extras->>'valorBase')::numeric, c.valor),
  valor_cobrado_cliente = COALESCE(c.valor_cobrado_cliente, c.valor),
  valor_repassado_cliente = GREATEST(0, COALESCE(c.valor_cobrado_cliente, c.valor) - COALESCE(c.valor_principal, (c.dados_extras->>'valorBase')::numeric, c.valor))
WHERE c.provedor = 'asaas';

-- 3. Backfill e saneamento em cobranca_parcelas
UPDATE public.cobranca_parcelas cp
SET
  valor_principal = ROUND(COALESCE(c.valor_principal, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2),
  valor_cobrado_cliente = ROUND(COALESCE(c.valor_cobrado_cliente, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2),
  valor_repassado_cliente = GREATEST(0, ROUND(COALESCE(c.valor_cobrado_cliente, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2) - ROUND(COALESCE(c.valor_principal, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2)),
  valor_bruto = ROUND(COALESCE(c.valor_principal, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2),
  taxa_processamento_real = GREATEST(0, ROUND(COALESCE(c.valor_cobrado_cliente, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2) - COALESCE(cp.valor_liquido, 0)),
  valor_liquido_creditado = COALESCE(cp.valor_liquido, cp.valor_bruto),
  taxa_gateway = GREATEST(0, ROUND(COALESCE(c.valor_cobrado_cliente, c.valor) / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2) - COALESCE(cp.valor_liquido, 0))
FROM public.cobrancas c
WHERE cp.cobranca_id = c.id
  AND c.provedor = 'asaas';

-- 4. Reconciliação em gateway_cash_movements
-- A. Atualizar amount de 'credit' para ser o valor_principal real
UPDATE public.gateway_cash_movements gm
SET 
  amount = cp.valor_principal,
  due_date = COALESCE(gm.due_date, cp.data_vencimento),
  competence_date = COALESCE(gm.competence_date, cp.data_pagamento, gm.movement_date),
  description = 'Crédito de serviço ' || cp.asaas_payment_id
FROM public.cobranca_parcelas cp
JOIN public.cobrancas c ON c.id = cp.cobranca_id
WHERE gm.parcela_id = cp.id
  AND gm.movement_type = 'credit'
  AND c.provedor = 'asaas';

-- B. Criar as linhas de 'pass_through' faltantes onde houve repasse ao cliente
INSERT INTO public.gateway_cash_movements (
  provider,
  provider_transaction_id,
  cobranca_id,
  parcela_id,
  movement_type,
  amount,
  movement_date,
  due_date,
  competence_date,
  description
)
SELECT
  'asaas',
  'payment_' || cp.asaas_payment_id || '_pass_through',
  cp.cobranca_id,
  cp.id,
  'pass_through',
  cp.valor_repassado_cliente,
  COALESCE(cp.data_credito::timestamptz, cp.data_pagamento, now()),
  cp.data_vencimento,
  COALESCE(cp.data_pagamento, cp.data_credito::timestamptz, now()),
  'Repasse de taxa cobrado do cliente ' || cp.asaas_payment_id
FROM public.cobranca_parcelas cp
JOIN public.cobrancas c ON c.id = cp.cobranca_id
WHERE c.provedor = 'asaas'
  AND cp.valor_repassado_cliente > 0
  AND cp.status IN ('confirmado', 'recebido', 'antecipado')
ON CONFLICT (provider, provider_transaction_id, movement_type) 
DO UPDATE SET 
  amount = EXCLUDED.amount,
  due_date = EXCLUDED.due_date,
  competence_date = EXCLUDED.competence_date;

-- C. Atualizar due_date nas linhas de 'fee'
UPDATE public.gateway_cash_movements gm
SET 
  due_date = COALESCE(gm.due_date, cp.data_vencimento),
  competence_date = COALESCE(gm.competence_date, cp.data_pagamento, gm.movement_date)
FROM public.cobranca_parcelas cp
WHERE gm.parcela_id = cp.id
  AND gm.movement_type = 'fee'
  AND gm.provider = 'asaas';

-- 5. Disparar recálculo de todas as sessões para consolidar valor_pago
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT session_id FROM public.clientes_sessoes WHERE session_id IS NOT NULL LOOP
    PERFORM public.recompute_session_paid(r.session_id);
  END LOOP;
END $$;
