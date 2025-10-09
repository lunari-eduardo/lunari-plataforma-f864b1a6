-- FASE 2: Recalcular valor_total para todas as sessões
-- Garantir que valor_total está correto baseado nos componentes

UPDATE public.clientes_sessoes
SET 
  valor_total = (
    COALESCE(valor_base_pacote, 0) +
    COALESCE(valor_total_foto_extra, 0) +
    COALESCE(valor_adicional, 0) +
    COALESCE(public.calculate_manual_products_total(produtos_incluidos), 0) -
    COALESCE(desconto, 0)
  ),
  updated_at = now()
WHERE valor_total != (
  COALESCE(valor_base_pacote, 0) +
  COALESCE(valor_total_foto_extra, 0) +
  COALESCE(valor_adicional, 0) +
  COALESCE(public.calculate_manual_products_total(produtos_incluidos), 0) -
  COALESCE(desconto, 0)
);

-- Log do resultado
DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'FASE 2: Recalculados valor_total para % sessões', rows_updated;
END $$;