
-- =============================================
-- Etapa 1: Tabelas e colunas novas
-- =============================================

-- 1.1 Nova tabela cobranca_parcelas
CREATE TABLE public.cobranca_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  asaas_payment_id TEXT NOT NULL,
  valor_bruto NUMERIC NOT NULL,
  taxa_gateway NUMERIC DEFAULT 0,
  taxa_antecipacao NUMERIC DEFAULT 0,
  valor_liquido NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',
  billing_type TEXT,
  data_vencimento DATE,
  data_pagamento TIMESTAMPTZ,
  data_credito DATE,
  antecipado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (asaas_payment_id)
);

ALTER TABLE public.cobranca_parcelas ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own parcelas via cobrancas join
CREATE POLICY "Users can view own parcelas"
  ON public.cobranca_parcelas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cobrancas c
      WHERE c.id = cobranca_parcelas.cobranca_id
        AND c.user_id = auth.uid()
    )
  );

-- 1.2 Nova tabela asaas_webhook_events
CREATE TABLE public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payment_id TEXT,
  installment_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_webhook_event_dedup ON public.asaas_webhook_events(event_type, payment_id);

-- No RLS needed (only service role writes via webhook)

-- 1.3 Novas colunas em cobrancas
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS asaas_installment_id TEXT;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS total_parcelas INTEGER DEFAULT 1;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER DEFAULT 0;

-- =============================================
-- Etapa 2: Trigger de reconciliação em cobranca_parcelas
-- =============================================

CREATE OR REPLACE FUNCTION public.reconcile_cobranca_from_parcelas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_parcelas INTEGER;
  v_parcelas_pagas INTEGER;
  v_valor_liquido_total NUMERIC;
  v_new_status TEXT;
  v_current_status TEXT;
BEGIN
  -- Count paid parcelas (confirmado, recebido, antecipado count as paid)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')),
    COALESCE(SUM(valor_liquido) FILTER (WHERE status IN ('confirmado', 'recebido', 'antecipado')), 0)
  INTO v_parcelas_pagas, v_valor_liquido_total
  FROM public.cobranca_parcelas
  WHERE cobranca_id = NEW.cobranca_id;

  -- Get total_parcelas and current status from cobranca
  SELECT total_parcelas, status INTO v_total_parcelas, v_current_status
  FROM public.cobrancas
  WHERE id = NEW.cobranca_id;

  -- Determine new status
  IF v_parcelas_pagas >= v_total_parcelas AND v_total_parcelas > 0 THEN
    v_new_status := 'pago';
  ELSIF v_parcelas_pagas > 0 THEN
    v_new_status := 'parcialmente_pago';
  ELSE
    v_new_status := v_current_status; -- keep current (pendente/cancelado)
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

  RAISE NOTICE 'Reconciled cobranca %: parcelas_pagas=%, status=%, valor_liquido=%',
    NEW.cobranca_id, v_parcelas_pagas, v_new_status, v_valor_liquido_total;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_reconcile_cobranca_parcelas
  AFTER INSERT OR UPDATE ON public.cobranca_parcelas
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_cobranca_from_parcelas();

-- =============================================
-- Etapa 3: Atualizar trigger ensure_transaction_on_cobranca_paid para usar valor bruto
-- =============================================

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
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    IF NEW.session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Use valor (bruto) for financial transaction - represents what client paid
    v_valor_transacao := NEW.valor;
    
    SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id OR id::text = NEW.session_id
    LIMIT 1;
    
    IF v_session_text IS NULL THEN
      v_session_text := NEW.session_id;
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;
    
    -- Dedup by cobranca ID reference
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE session_id = v_session_text
      AND tipo = 'pagamento'
      AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
    LIMIT 1;
    
    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, tipo, data_transacao, descricao
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        v_valor_transacao,
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
      RAISE NOTICE 'Auto-created transaction for cobranca % (session: %, valor: % [bruto])', NEW.id, v_session_text, v_valor_transacao;
    ELSE
      RAISE NOTICE 'Dedup: transaction already exists (%) for cobranca % - skipping', v_existing_tx, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
