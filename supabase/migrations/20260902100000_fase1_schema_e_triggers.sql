-- ==============================================================================
-- Migration: 20260902100000_fase1_schema_e_triggers.sql
-- Fase 1 da Arquitetura Financeira Definitiva:
-- 1. Novas colunas em cobrancas, cobranca_parcelas e gateway_cash_movements
-- 2. Função payment_status_rank para guarda de ordem de status
-- 3. Atualização de reconcile_cobranca_from_parcelas como autor único de valor_liquido/status
-- ==============================================================================

-- 1. Novas colunas
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS valor_repassado_cliente NUMERIC DEFAULT 0;

ALTER TABLE public.cobranca_parcelas
  ADD COLUMN IF NOT EXISTS valor_repassado_cliente NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_pagamento_gateway TIMESTAMPTZ;

ALTER TABLE public.gateway_cash_movements
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS competence_date TIMESTAMPTZ;

-- 2. Função para ordenação hierárquica de status de pagamentos (Prevenção de race conditions)
CREATE OR REPLACE FUNCTION public.payment_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_status, ''))
    WHEN 'pendente' THEN 1
    WHEN 'agendado' THEN 1
    WHEN 'aguardando' THEN 1
    WHEN 'parcialmente_pago' THEN 2
    WHEN 'confirmado' THEN 3
    WHEN 'recebido' THEN 4
    WHEN 'antecipado' THEN 4
    WHEN 'estornado' THEN 5
    WHEN 'restituido' THEN 5
    WHEN 'chargeback' THEN 5
    WHEN 'cancelado' THEN 5
    WHEN 'reprovado' THEN 5
    ELSE 0
  END;
$$;

-- 3. Atualização de reconcile_cobranca_from_parcelas
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
    COALESCE(SUM(COALESCE(taxa_processamento_real, taxa_gateway, 0)) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0)
  INTO
    v_parcelas_pagas,
    v_total_liquido_creditado,
    v_total_principal_pago,
    v_total_repassado,
    v_total_taxa_proc
  FROM public.cobranca_parcelas
  WHERE cobranca_id = NEW.cobranca_id;

  -- 3. Determinar novo status
  IF v_parcelas_pagas >= v_total_parcelas AND v_total_parcelas > 0 THEN
    v_new_status := 'pago';
  ELSIF v_parcelas_pagas > 0 THEN
    v_new_status := 'parcialmente_pago';
  ELSE
    -- Manter status atual se não houve pagamento, a menos que parcelas indiquem estorno/cancelamento
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
    valor_repassado_cliente = v_total_repassado,
    status = v_new_status,
    data_pagamento = CASE WHEN v_new_status = 'pago' AND data_pagamento IS NULL THEN now() ELSE data_pagamento END,
    updated_at = now()
  WHERE id = NEW.cobranca_id;

  RETURN NEW;
END;
$$;
