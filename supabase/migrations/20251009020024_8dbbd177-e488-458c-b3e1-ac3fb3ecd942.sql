-- FASE 5: Recalcular e corrigir valor_total para todas as sessões existentes
-- Este script corrige inconsistências nos totais das sessões

-- Update valor_total using the correct formula
UPDATE public.clientes_sessoes
SET valor_total = (
  COALESCE(valor_base_pacote, 0) +
  COALESCE(valor_total_foto_extra, 0) +
  COALESCE(valor_adicional, 0) +
  COALESCE(public.calculate_manual_products_total(produtos_incluidos), 0) -
  COALESCE(desconto, 0)
)
WHERE 
  -- Only update sessions that have values that affect the total
  (valor_total_foto_extra IS NOT NULL AND valor_total_foto_extra > 0) OR
  (valor_adicional IS NOT NULL AND valor_adicional > 0) OR
  (desconto IS NOT NULL AND desconto > 0) OR
  (produtos_incluidos IS NOT NULL AND produtos_incluidos::text != '[]');

-- Log para debug
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % sessions with corrected valor_total', updated_count;
END $$;