-- FASE 1: Estrutura do Banco
-- 1. Adicionar updated_by em clientes_sessoes
ALTER TABLE clientes_sessoes 
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- 2. Adicionar updated_at e updated_by em clientes_transacoes  
ALTER TABLE clientes_transacoes 
ADD COLUMN updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- 3. Criar FOREIGN KEY clientes_transacoes.session_id → clientes_sessoes.session_id com ON DELETE SET NULL
ALTER TABLE clientes_transacoes 
ADD CONSTRAINT fk_transacoes_session_id 
FOREIGN KEY (session_id) REFERENCES clientes_sessoes(session_id) ON DELETE SET NULL;

-- 4. Criar triggers para atualizar updated_at automaticamente em clientes_transacoes
CREATE TRIGGER update_clientes_transacoes_updated_at
  BEFORE UPDATE ON clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Migração de dados: preencher updated_by inicial com user_id para dados existentes
UPDATE clientes_sessoes 
SET updated_by = user_id 
WHERE updated_by IS NULL;

UPDATE clientes_transacoes 
SET updated_by = user_id 
WHERE updated_by IS NULL;

-- 6. Migração: tentar inferir session_id para transações sem vínculo
-- Vincula transações aos sessions baseado em cliente_id e data próxima
UPDATE clientes_transacoes ct
SET session_id = cs.session_id
FROM clientes_sessoes cs
WHERE ct.session_id IS NULL 
  AND ct.cliente_id = cs.cliente_id 
  AND ct.data_transacao = cs.data_sessao
  AND ct.user_id = cs.user_id;