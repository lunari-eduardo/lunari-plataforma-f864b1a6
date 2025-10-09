-- FASE 2: Corrigir valor_base_pacote extraindo do JSON congelado
-- O problema: a migração anterior usou regras_congeladas->>'valorBase' 
-- O correto: regras_congeladas->'pacote'->>'valorBase'

UPDATE public.clientes_sessoes
SET valor_base_pacote = COALESCE(
  (regras_congeladas->'pacote'->>'valorBase')::numeric,
  0
)
WHERE regras_congeladas IS NOT NULL 
  AND regras_congeladas->'pacote' IS NOT NULL
  AND regras_congeladas->'pacote'->>'valorBase' IS NOT NULL;

-- Log para verificação
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Corrected valor_base_pacote for % sessions', updated_count;
END $$;