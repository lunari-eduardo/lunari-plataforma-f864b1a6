-- Adicionar coluna data_vencimento para pagamentos agendados/parcelados
ALTER TABLE clientes_transacoes 
ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN clientes_transacoes.data_vencimento IS 
'Data de vencimento para pagamentos agendados/parcelados. NULL para pagamentos já realizados.';

-- Adicionar tracking [ID:uuid] a pagamentos legados que não possuem
UPDATE clientes_transacoes
SET descricao = CASE 
  WHEN descricao IS NULL OR descricao = '' THEN '[ID:' || id::text || ']'
  ELSE descricao || ' [ID:' || id::text || ']'
END
WHERE tipo = 'pagamento' 
  AND (descricao NOT LIKE '%[ID:%]' OR descricao IS NULL);