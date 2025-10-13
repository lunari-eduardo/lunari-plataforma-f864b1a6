-- ============================================
-- FASE 5: TRIGGER PARA AUTO-UPDATE DE STATUS
-- ============================================

-- Função para atualizar status automaticamente
CREATE OR REPLACE FUNCTION update_fin_transaction_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a transação está Agendada e a data de vencimento chegou ou passou
  IF NEW.status = 'Agendado' AND NEW.data_vencimento <= CURRENT_DATE THEN
    NEW.status = 'Faturado';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que executa ANTES de INSERT ou UPDATE
CREATE TRIGGER trigger_update_transaction_status
BEFORE INSERT OR UPDATE ON fin_transactions
FOR EACH ROW
EXECUTE FUNCTION update_fin_transaction_status();

-- ============================================
-- ÍNDICES DE PERFORMANCE
-- ============================================

-- Índice para queries por usuário e data (mais comum)
CREATE INDEX IF NOT EXISTS idx_fin_transactions_user_date 
ON fin_transactions(user_id, data_vencimento DESC);

-- Índice para queries por status
CREATE INDEX IF NOT EXISTS idx_fin_transactions_status 
ON fin_transactions(user_id, status);

-- Índice para queries por item financeiro
CREATE INDEX IF NOT EXISTS idx_fin_transactions_item 
ON fin_transactions(item_id);

-- Índice para queries por cartão de crédito
CREATE INDEX IF NOT EXISTS idx_fin_transactions_credit_card 
ON fin_transactions(credit_card_id) WHERE credit_card_id IS NOT NULL;

-- Índice para itens ativos por usuário
CREATE INDEX IF NOT EXISTS idx_fin_items_user_active
ON fin_items_master(user_id, ativo) WHERE ativo = true;