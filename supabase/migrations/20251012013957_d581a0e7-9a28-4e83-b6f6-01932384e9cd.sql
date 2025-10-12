-- =====================================================
-- SISTEMA FINANCEIRO - TABELAS NOVAS
-- =====================================================

-- Tabela 1: Lista Mestre de Itens Financeiros (DAS, Aluguel, etc.)
CREATE TABLE IF NOT EXISTS public.fin_items_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  grupo_principal TEXT NOT NULL CHECK (grupo_principal IN (
    'Despesa Fixa', 
    'Despesa Variável', 
    'Investimento', 
    'Receita Não Operacional',
    'Receita Operacional'
  )),
  ativo BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fin_items_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fin items master"
  ON public.fin_items_master
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fin_items_master_user ON public.fin_items_master(user_id);
CREATE INDEX idx_fin_items_master_grupo ON public.fin_items_master(grupo_principal);
CREATE INDEX idx_fin_items_master_ativo ON public.fin_items_master(ativo);

-- =====================================================
-- Tabela 2: Cartões de Crédito
CREATE TABLE IF NOT EXISTS public.fin_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fin_credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own credit cards"
  ON public.fin_credit_cards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fin_credit_cards_user ON public.fin_credit_cards(user_id);
CREATE INDEX idx_fin_credit_cards_ativo ON public.fin_credit_cards(ativo);

-- =====================================================
-- Tabela 3: Blueprints de Recorrência
CREATE TABLE IF NOT EXISTS public.fin_recurring_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.fin_items_master(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL CHECK (valor >= 0),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  is_valor_fixo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fin_recurring_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recurring blueprints"
  ON public.fin_recurring_blueprints
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fin_recurring_blueprints_user ON public.fin_recurring_blueprints(user_id);
CREATE INDEX idx_fin_recurring_blueprints_item ON public.fin_recurring_blueprints(item_id);

-- =====================================================
-- Tabela 4: Transações Financeiras
CREATE TABLE IF NOT EXISTS public.fin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.fin_items_master(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Faturado', 'Pago')),
  observacoes TEXT,
  parcela_atual INTEGER,
  parcela_total INTEGER,
  recurring_blueprint_id UUID REFERENCES public.fin_recurring_blueprints(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES public.fin_credit_cards(id) ON DELETE SET NULL,
  data_compra DATE,
  parent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fin transactions"
  ON public.fin_transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fin_transactions_user ON public.fin_transactions(user_id);
CREATE INDEX idx_fin_transactions_item ON public.fin_transactions(item_id);
CREATE INDEX idx_fin_transactions_date ON public.fin_transactions(data_vencimento);
CREATE INDEX idx_fin_transactions_status ON public.fin_transactions(status);
CREATE INDEX idx_fin_transactions_card ON public.fin_transactions(credit_card_id);
CREATE INDEX idx_fin_transactions_blueprint ON public.fin_transactions(recurring_blueprint_id);

-- =====================================================
-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_fin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fin_items_master_updated_at
  BEFORE UPDATE ON public.fin_items_master
  FOR EACH ROW EXECUTE FUNCTION public.update_fin_updated_at();

CREATE TRIGGER trigger_fin_transactions_updated_at
  BEFORE UPDATE ON public.fin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_fin_updated_at();

CREATE TRIGGER trigger_fin_recurring_blueprints_updated_at
  BEFORE UPDATE ON public.fin_recurring_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.update_fin_updated_at();

CREATE TRIGGER trigger_fin_credit_cards_updated_at
  BEFORE UPDATE ON public.fin_credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_fin_updated_at();

-- =====================================================
-- Habilitar Realtime
ALTER TABLE public.fin_items_master REPLICA IDENTITY FULL;
ALTER TABLE public.fin_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.fin_recurring_blueprints REPLICA IDENTITY FULL;
ALTER TABLE public.fin_credit_cards REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_items_master;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_recurring_blueprints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_credit_cards;