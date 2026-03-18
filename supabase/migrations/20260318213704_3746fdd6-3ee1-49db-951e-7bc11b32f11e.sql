
-- Add valor_liquido, taxa_gateway, taxa_antecipacao columns to clientes_transacoes
ALTER TABLE public.clientes_transacoes
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC,
  ADD COLUMN IF NOT EXISTS taxa_gateway NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_antecipacao NUMERIC DEFAULT 0;

-- Update trigger to populate new columns from cobrancas
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
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    IF NEW.session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    v_valor_transacao := NEW.valor;
    v_valor_liquido := NEW.valor_liquido;
    
    -- Calculate gateway fee as difference between gross and net
    IF v_valor_liquido IS NOT NULL AND v_valor_liquido > 0 THEN
      v_taxa_gateway := ROUND(v_valor_transacao - v_valor_liquido, 2);
    ELSE
      v_taxa_gateway := 0;
    END IF;
    
    -- Check for anticipation fees in dados_extras
    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
      -- Adjust: taxa_gateway includes anticipation, so separate them
      IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
        v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
      END IF;
    END IF;
    
    SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id OR id::text = NEW.session_id
    LIMIT 1;
    
    v_session_exists := (v_session_text IS NOT NULL);
    
    IF NOT v_session_exists THEN
      v_session_text := NULL;
      v_cliente_id := NEW.cliente_id;
      RAISE WARNING 'Session % not found for cobranca %, creating transaction without session_id', NEW.session_id, NEW.id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      RAISE WARNING 'No cliente_id for cobranca %, skipping transaction', NEW.id;
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE tipo = 'pagamento'
      AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
    LIMIT 1;
    
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
          CASE WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay' 
               WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
               WHEN NEW.provedor = 'asaas' THEN 'Asaas'
               ELSE COALESCE(NEW.provedor, 'manual') END,
          NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END
        )
      );
      RAISE NOTICE 'Auto-created transaction for cobranca % (session: %, bruto: %, liquido: %, taxa_gw: %, taxa_ant: %)', 
        NEW.id, v_session_text, v_valor_transacao, v_valor_liquido, v_taxa_gateway, v_taxa_antecipacao;
    ELSE
      -- Update existing transaction with net values if they were missing
      UPDATE public.clientes_transacoes
      SET valor_liquido = v_valor_liquido,
          taxa_gateway = v_taxa_gateway,
          taxa_antecipacao = v_taxa_antecipacao
      WHERE id = v_existing_tx
        AND (valor_liquido IS NULL OR valor_liquido = 0);
      RAISE NOTICE 'Dedup: transaction already exists (%) for cobranca % - updated net values', v_existing_tx, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
