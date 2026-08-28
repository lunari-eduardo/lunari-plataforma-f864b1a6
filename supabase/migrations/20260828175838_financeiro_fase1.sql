-- Fase 1: Schema Compatível

-- 1. Tabelas de infraestrutura de Gateway
CREATE TABLE IF NOT EXISTS public.gateway_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_events_dedup ON public.gateway_events(provider, provider_event_id);
ALTER TABLE public.gateway_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gateway_anticipations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_anticipation_id TEXT NOT NULL,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  parcela_id UUID REFERENCES public.cobranca_parcelas(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC NOT NULL DEFAULT 0,
  request_date TIMESTAMPTZ,
  credit_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_anticipations_dedup ON public.gateway_anticipations(provider, provider_anticipation_id);
ALTER TABLE public.gateway_anticipations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gateway_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  parcela_id UUID REFERENCES public.cobranca_parcelas(id) ON DELETE SET NULL,
  anticipation_id UUID REFERENCES public.gateway_anticipations(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL, -- 'credit', 'debit', 'fee', 'refund', 'chargeback'
  amount NUMERIC NOT NULL,
  movement_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_cash_movements_dedup ON public.gateway_cash_movements(provider, provider_transaction_id, movement_type);
ALTER TABLE public.gateway_cash_movements ENABLE ROW LEVEL SECURITY;


-- 2. Novas colunas em cobrancas
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS valor_principal NUMERIC;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS valor_cobrado_cliente NUMERIC;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS taxa_processamento_real NUMERIC DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS taxa_antecipacao_real NUMERIC DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS valor_liquido_creditado NUMERIC DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS fee_policy_snapshot JSONB;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS source_event_id UUID REFERENCES public.gateway_events(id) ON DELETE SET NULL;

-- 3. Novas colunas em cobranca_parcelas
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS valor_principal NUMERIC;
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS valor_cobrado_cliente NUMERIC;
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS taxa_processamento_real NUMERIC DEFAULT 0;
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS taxa_antecipacao_real NUMERIC DEFAULT 0;
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS valor_liquido_creditado NUMERIC DEFAULT 0;
ALTER TABLE public.cobranca_parcelas ADD COLUMN IF NOT EXISTS source_event_id UUID REFERENCES public.gateway_events(id) ON DELETE SET NULL;

-- 4. Novas colunas em clientes_transacoes
ALTER TABLE public.clientes_transacoes ADD COLUMN IF NOT EXISTS dados_extras JSONB;

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_cobranca_parcelas_cobranca_id ON public.cobranca_parcelas(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_parcelas_status ON public.cobranca_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_gateway_cash_movements_cobranca_id ON public.gateway_cash_movements(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_gateway_cash_movements_parcela_id ON public.gateway_cash_movements(parcela_id);
CREATE INDEX IF NOT EXISTS idx_gateway_cash_movements_date ON public.gateway_cash_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_gateway_anticipations_cobranca_id ON public.gateway_anticipations(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_gateway_anticipations_parcela_id ON public.gateway_anticipations(parcela_id);

-- 6. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gateway_cash_movements' 
      AND policyname = 'Users can view own gateway cash movements'
  ) THEN
    CREATE POLICY "Users can view own gateway cash movements" ON public.gateway_cash_movements
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.cobrancas c 
        WHERE c.id = gateway_cash_movements.cobranca_id 
          AND c.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gateway_anticipations' 
      AND policyname = 'Users can view own gateway anticipations'
  ) THEN
    CREATE POLICY "Users can view own gateway anticipations" ON public.gateway_anticipations
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.cobrancas c 
        WHERE c.id = gateway_anticipations.cobranca_id 
          AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$;
