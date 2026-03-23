-- FIX 1: Update trigger to handle standalone galleries (session_id = NULL)
-- Previously the trigger did: IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
-- This skipped all standalone gallery payments. Now it looks up cliente_id from galeria_id.

CREATE OR REPLACE FUNCTION public.ensure_transaction_on_cobranca_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_text TEXT;
  v_cliente_id UUID;
  v_existing_tx UUID;
  v_valor_transacao NUMERIC;
  v_valor_liquido NUMERIC;
  v_taxa_gateway NUMERIC;
  v_taxa_antecipacao NUMERIC;
  v_session_exists BOOLEAN;
  v_provedor_label TEXT;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN
    
    v_valor_transacao := NEW.valor;
    v_valor_liquido := NEW.valor_liquido;
    
    IF v_valor_liquido IS NOT NULL AND v_valor_liquido > 0 THEN
      v_taxa_gateway := ROUND(v_valor_transacao - v_valor_liquido, 2);
    ELSE
      v_taxa_gateway := 0;
    END IF;
    
    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
      IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
        v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
      END IF;
    END IF;
    
    IF NEW.session_id IS NOT NULL THEN
      SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
      FROM public.clientes_sessoes
      WHERE session_id = NEW.session_id OR id::text = NEW.session_id
      LIMIT 1;
    END IF;
    
    v_session_exists := (v_session_text IS NOT NULL);
    
    IF v_cliente_id IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT cliente_id INTO v_cliente_id
      FROM public.galerias
      WHERE id = NEW.galeria_id
      LIMIT 1;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    IF NOT v_session_exists THEN
      v_session_text := NEW.session_id;
    END IF;
    
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE tipo = 'pagamento'
      AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
    LIMIT 1;
    
    v_provedor_label := CASE
      WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.provedor = 'asaas' THEN 'Asaas'
      WHEN NEW.provedor = 'manual' THEN COALESCE(NEW.metodo_manual, 'Manual')
      ELSE COALESCE(NEW.provedor, 'manual')
    END;
    
    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao, tipo, data_transacao, descricao
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento::date, CURRENT_DATE),
        FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]',
          v_provedor_label,
          NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END
        )
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET valor_liquido = v_valor_liquido,
          taxa_gateway = v_taxa_gateway,
          taxa_antecipacao = v_taxa_antecipacao
      WHERE id = v_existing_tx
        AND (valor_liquido IS NULL OR valor_liquido = 0);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- FIX 2: Data repair - toggle stuck cobranças to fire the updated trigger

-- Cobrança 1102ed52 (session_id exists, valor=14)
UPDATE cobrancas SET status = 'pendente', updated_at = now()
WHERE id = '1102ed52-93bc-498e-aacd-2269ccda296c' AND status = 'pago';

UPDATE cobrancas SET status = 'pago', data_pagamento = '2026-03-23T04:53:06.895Z', updated_at = now()
WHERE id = '1102ed52-93bc-498e-aacd-2269ccda296c' AND status = 'pendente';

-- Cobrança abaa7d9e (standalone gallery, no session_id, valor=20)
UPDATE cobrancas SET status = 'pendente', updated_at = now()
WHERE id = 'abaa7d9e-a32d-4a0b-965e-a5777f500986' AND status = 'pago';

UPDATE cobrancas SET status = 'pago', data_pagamento = '2026-03-23T01:33:38.674Z', updated_at = now()
WHERE id = 'abaa7d9e-a32d-4a0b-965e-a5777f500986' AND status = 'pendente';