-- Drop the existing CHECK constraint on tipo column
ALTER TABLE public.clientes_transacoes 
  DROP CONSTRAINT IF EXISTS clientes_transacoes_tipo_check;

-- Re-create with 'estorno' included
ALTER TABLE public.clientes_transacoes 
  ADD CONSTRAINT clientes_transacoes_tipo_check 
  CHECK (tipo IN ('pagamento', 'desconto', 'ajuste', 'estorno'));