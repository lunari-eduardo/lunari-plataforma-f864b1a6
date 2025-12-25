-- 1. Dropar trigger antigo com configuração incorreta
DROP TRIGGER IF EXISTS trigger_update_transaction_status ON fin_transactions;

-- 2. Recriar trigger para responder a INSERT e UPDATE
CREATE TRIGGER trigger_update_transaction_status
  BEFORE INSERT OR UPDATE ON fin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_fin_transaction_status();

-- 3. Corrigir TODAS as transações antigas que deveriam ser "Faturado"
-- Isso inclui despesas fixas, variáveis, investimentos e receitas
UPDATE fin_transactions
SET status = 'Faturado', updated_at = now()
WHERE status = 'Agendado'
  AND data_vencimento <= CURRENT_DATE;