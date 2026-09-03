-- ==============================================================================
-- Migration: 20260906000000_fix_workflow_valor_vendido.sql
-- Alinhamento contábil do Workflow:
-- 1. Garante que o Workflow registra estritamente o valor comercial vendido do contrato.
-- 2. Repasses de taxas ao cliente (gross-up) não inflam o valor pago nem abatem o contrato.
-- 3. Absorções de taxas pelo fotógrafo não reduzem o valor pago (o cliente quita a venda integral).
-- 4. Preserva compatibilidade e integridade de todos os provedores (Asaas, Mercado Pago, InfinitePay, Manual).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_soma_tx NUMERIC := 0;
  v_soma_parcelas NUMERIC := 0;
BEGIN
  -- 1) Soma das transacoes manuais e de outros gateways (Mercado Pago, InfinitePay, Pix manual)
  -- Nota: ct.valor armazena estritamente o valor comercial da venda (sem repasses de taxa)
  SELECT COALESCE(SUM(CASE WHEN ct.tipo = 'estorno' THEN -ct.valor ELSE ct.valor END), 0)
  INTO v_soma_tx
  FROM public.clientes_transacoes ct
  LEFT JOIN public.cobrancas c ON ct.cobranca_id = c.id
  WHERE ct.session_id = p_session_id 
    AND ct.tipo IN ('pagamento', 'estorno')
    AND (c.provedor IS DISTINCT FROM 'asaas' OR ct.dados_extras->>'migrado_para_gateway' IS NULL);

  -- 2) Soma do valor da venda (nominal/comercial) quitado nas parcelas do Asaas
  -- REGRA CANÔNICA:
  -- - Se houver repasse de taxas ao cliente (gross-up), o repasse NÃO abate o contrato da sessão:
  --   abate apenas o valor vendido (valor_cobrado - valor_repassado).
  -- - Se o fotógrafo absorver as taxas, a taxa do gateway NÃO é descontada da sessão:
  --   o cliente quita a venda integral (valor_principal).
  SELECT COALESCE(SUM(
    CASE 
      -- Se a parcela tem repasse registrado > 0, desconta o repasse para isolar o valor vendido
      WHEN COALESCE(cp.valor_repassado_cliente, 0) > 0 THEN 
        cp.valor_cobrado_cliente - cp.valor_repassado_cliente
      -- Se a cobrança pai tem repasse registrado e a parcela não tem repasse decomposto
      WHEN COALESCE(c.valor_repassado_cliente, 0) > 0 AND COALESCE(c.total_parcelas, 1) > 0 THEN 
        ROUND(COALESCE(c.valor_principal, (c.dados_extras->>'valorBase')::numeric, c.valor) / c.total_parcelas, 2)
      -- Se tem valor_principal definido na parcela
      WHEN cp.valor_principal IS NOT NULL AND cp.valor_principal > 0 THEN 
        cp.valor_principal
      -- Se tem valor_principal na cobrança pai
      WHEN c.valor_principal IS NOT NULL AND c.valor_principal > 0 AND COALESCE(c.total_parcelas, 1) > 0 THEN 
        ROUND(c.valor_principal / c.total_parcelas, 2)
      -- Se tem valorBase em dados_extras
      WHEN (c.dados_extras->>'valorBase') IS NOT NULL AND COALESCE(c.total_parcelas, 1) > 0 THEN 
        ROUND((c.dados_extras->>'valorBase')::numeric / c.total_parcelas, 2)
      -- Fallback para valor nominal da parcela ou cobrança
      ELSE 
        COALESCE(cp.valor_bruto, ROUND(c.valor / GREATEST(COALESCE(c.total_parcelas, 1), 1), 2))
    END
  ), 0)
  INTO v_soma_parcelas
  FROM public.cobranca_parcelas cp
  JOIN public.cobrancas c ON c.id = cp.cobranca_id
  WHERE (c.session_id = p_session_id OR c.galeria_id IN (SELECT id FROM public.galerias WHERE session_id = p_session_id))
    AND c.provedor = 'asaas'
    AND cp.status IN ('confirmado', 'recebido', 'antecipado');

  UPDATE public.clientes_sessoes
  SET 
    valor_pago = v_soma_tx + v_soma_parcelas,
    updated_at = NOW()
  WHERE session_id = p_session_id OR id::text = p_session_id;
  
  RAISE NOTICE 'Recalculado valor_pago para session_id: %, total=% (tx=%, parcelas=%)', p_session_id, (v_soma_tx + v_soma_parcelas), v_soma_tx, v_soma_parcelas;
END;
$function$;
