-- Add missing fields to clientes_sessoes table
-- These fields are needed for saving desconto, valor_adicional, observacoes, and detalhes

-- Add desconto column (discount amount)
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;

-- Add valor_adicional column (additional amount)
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS valor_adicional numeric DEFAULT 0;

-- Add observacoes column (observations/notes)
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS observacoes text;

-- Add detalhes column (details)
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS detalhes text;

-- Ensure updated_at trigger exists for clientes_sessoes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate to ensure it's active
DROP TRIGGER IF EXISTS update_clientes_sessoes_updated_at ON clientes_sessoes;

CREATE TRIGGER update_clientes_sessoes_updated_at
  BEFORE UPDATE ON clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();