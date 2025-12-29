-- Tabela para persistir transações de equipamento ignoradas
CREATE TABLE IF NOT EXISTS pricing_ignored_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, transaction_id)
);

-- Habilitar RLS
ALTER TABLE pricing_ignored_transactions ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem suas transações ignoradas
CREATE POLICY "Users manage own ignored transactions" ON pricing_ignored_transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX idx_pricing_ignored_transactions_user ON pricing_ignored_transactions(user_id);