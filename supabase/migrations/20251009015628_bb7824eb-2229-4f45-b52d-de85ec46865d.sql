-- FASE 1: Adicionar coluna valor_base_pacote e migrar dados existentes

-- Adicionar nova coluna valor_base_pacote
ALTER TABLE public.clientes_sessoes 
ADD COLUMN IF NOT EXISTS valor_base_pacote numeric DEFAULT 0;

-- Migrar dados existentes de regras_congeladas.valorBase para valor_base_pacote
UPDATE public.clientes_sessoes
SET valor_base_pacote = COALESCE(
  (regras_congeladas->>'valorBase')::numeric,
  0
)
WHERE regras_congeladas IS NOT NULL 
  AND regras_congeladas->>'valorBase' IS NOT NULL;

-- Para sessões sem regras_congeladas, usar o valor_total atual como base temporária
UPDATE public.clientes_sessoes
SET valor_base_pacote = COALESCE(valor_total, 0)
WHERE valor_base_pacote = 0 OR valor_base_pacote IS NULL;

-- Criar índice para melhorar performance em queries
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_valor_base_pacote 
ON public.clientes_sessoes(valor_base_pacote);

-- Comentário explicativo
COMMENT ON COLUMN public.clientes_sessoes.valor_base_pacote IS 'Valor base do pacote congelado no momento da criação da sessão';