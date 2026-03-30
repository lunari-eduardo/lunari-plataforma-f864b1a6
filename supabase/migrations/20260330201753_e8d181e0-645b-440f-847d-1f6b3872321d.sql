-- =============================================
-- Fix reconcile_cobranca_from_parcelas to respect repasse flags
-- When taxes are passed to client, valor_liquido for photographer = valor nominal
-- =============================================

CREATE OR REPLACE FUNCTION public.reconcile_cobranca_from_parcelas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_parcelas INTEGER;
  v_parcelas_pagas INTEGER;
  v_valor_liquido_total NUMERIC;
  v_new_status TEXT;
  v_current_status TEXT;
  v_cobranca_valor NUMERIC;
  v_dados_extras JSONB;
  v_repassar_processamento BOOLEAN;
  v_repassar_antecipacao BOOLEAN;
BEGIN
  -- Count paid parcelas (confirmado, recebido, antecipado count as paid)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')),
    COALESCE(SUM(valor_liquido) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0)
  INTO v_parcelas_pagas, v_valor_liquido_total
  FROM public.cobranca_parcelas
  WHERE cobranca_id = NEW.cobranca_id;

  -- Get total_parcelas, current status, valor, and dados_extras from cobranca
  SELECT total_parcelas, status, valor, COALESCE(dados_extras, '{}'::jsonb)
  INTO v_total_parcelas, v_current_status, v_cobranca_valor, v_dados_extras
  FROM public.cobrancas
  WHERE id = NEW.cobranca_id;

  -- Check repasse flags
  v_repassar_processamento := COALESCE((v_dados_extras->>'repassarTaxasProcessamento')::boolean, false);
  v_repassar_antecipacao := COALESCE((v_dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

  -- If ALL taxes are passed to client, photographer receives the full nominal value
  -- valor_liquido should reflect photographer's perspective, not gateway's
  IF v_repassar_processamento AND v_repassar_antecipacao THEN
    -- Photographer receives full nominal value, proportional to paid parcelas
    v_valor_liquido_total := CASE 
      WHEN v_total_parcelas > 0 THEN (v_cobranca_valor / v_total_parcelas) * v_parcelas_pagas
      ELSE v_cobranca_valor
    END;
  ELSIF v_repassar_processamento THEN
    -- Processing taxes passed to client, but anticipation absorbed by photographer
    -- Subtract only anticipation taxes from nominal value
    v_valor_liquido_total := CASE 
      WHEN v_total_parcelas > 0 THEN 
        (v_cobranca_valor / v_total_parcelas) * v_parcelas_pagas
        - COALESCE((SELECT SUM(COALESCE(taxa_antecipacao, 0)) FROM public.cobranca_parcelas 
                    WHERE cobranca_id = NEW.cobranca_id AND status IN ('confirmado', 'recebido', 'antecipado')), 0)
      ELSE v_cobranca_valor
    END;
  ELSIF v_repassar_antecipacao THEN
    -- Anticipation passed to client, but processing absorbed by photographer
    -- Use gateway valor_liquido but add back anticipation taxes
    v_valor_liquido_total := v_valor_liquido_total
      + COALESCE((SELECT SUM(COALESCE(taxa_antecipacao, 0)) FROM public.cobranca_parcelas 
                  WHERE cobranca_id = NEW.cobranca_id AND status IN ('confirmado', 'recebido', 'antecipado')), 0);
  END IF;
  -- If neither flag is set, v_valor_liquido_total stays as SUM(parcelas.valor_liquido) — photographer absorbs all

  -- Determine new status
  IF v_parcelas_pagas >= v_total_parcelas AND v_total_parcelas > 0 THEN
    v_new_status := 'pago';
  ELSIF v_parcelas_pagas > 0 THEN
    v_new_status := 'parcialmente_pago';
  ELSE
    v_new_status := v_current_status;
  END IF;

  -- Update cobranca
  UPDATE public.cobrancas
  SET
    parcelas_pagas = v_parcelas_pagas,
    valor_liquido = v_valor_liquido_total,
    status = v_new_status,
    data_pagamento = CASE WHEN v_new_status = 'pago' AND data_pagamento IS NULL THEN now() ELSE data_pagamento END,
    updated_at = now()
  WHERE id = NEW.cobranca_id;

  RETURN NEW;
END;
$$;

-- =============================================
-- Backfill: Fix cobranca.valor_liquido for existing cobranças with repasse
-- =============================================

UPDATE public.cobrancas
SET valor_liquido = valor,
    updated_at = now()
WHERE provedor = 'asaas'
  AND status IN ('pago', 'parcialmente_pago')
  AND dados_extras IS NOT NULL
  AND (dados_extras->>'repassarTaxasProcessamento')::boolean = true
  AND (valor_liquido IS NULL OR valor_liquido <> valor);