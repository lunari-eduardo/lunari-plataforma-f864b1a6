-- FASE 4: Corrigir dados existentes

-- 4.1: Corrigir valor_base_pacote zerado usando regras_congeladas
UPDATE public.clientes_sessoes
SET valor_base_pacote = COALESCE(
  (regras_congeladas->'pacote'->>'valorBase')::numeric,
  (regras_congeladas->>'valorBase')::numeric,
  valor_total
)
WHERE (valor_base_pacote IS NULL OR valor_base_pacote = 0)
  AND regras_congeladas IS NOT NULL;

-- Log progress
DO $$
DECLARE
  updated_base INTEGER;
BEGIN
  GET DIAGNOSTICS updated_base = ROW_COUNT;
  RAISE NOTICE 'FASE 4.1: Corrected valor_base_pacote for % sessions', updated_base;
END $$;

-- 4.2: Recalcular valor_total para dados corrompidos (valores obviamente errados)
-- Só atualiza onde valor_total está muito maior que o esperado
UPDATE public.clientes_sessoes
SET valor_total = (
  COALESCE(valor_base_pacote, 0) +
  COALESCE(valor_total_foto_extra, 0) +
  COALESCE(valor_adicional, 0) +
  COALESCE(public.calculate_manual_products_total(produtos_incluidos), 0) -
  COALESCE(desconto, 0)
)
WHERE valor_total > (
  COALESCE(valor_base_pacote, 0) + 
  COALESCE(valor_total_foto_extra, 0) + 
  COALESCE(valor_adicional, 0) + 
  500 -- Margem de segurança
);

-- Log completion
DO $$
DECLARE
  corrected_totals INTEGER;
BEGIN
  GET DIAGNOSTICS corrected_totals = ROW_COUNT;
  RAISE NOTICE 'FASE 4.2: Recalculated valor_total for % corrupted sessions', corrected_totals;
  RAISE NOTICE 'FASE 4 Complete: Data correction finished successfully';
END $$;