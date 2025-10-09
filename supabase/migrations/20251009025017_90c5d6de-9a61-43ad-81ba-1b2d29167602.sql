-- FASE 3: Recalcular valor_total com valor_base_pacote CORRETO
-- Agora que valor_base_pacote está correto, recalcular todos os totais

UPDATE public.clientes_sessoes
SET valor_total = (
  COALESCE(valor_base_pacote, 0) +
  COALESCE(valor_total_foto_extra, 0) +
  COALESCE(valor_adicional, 0) +
  COALESCE(public.calculate_manual_products_total(produtos_incluidos), 0) -
  COALESCE(desconto, 0)
)
WHERE valor_base_pacote IS NOT NULL OR valor_total_foto_extra IS NOT NULL OR valor_adicional IS NOT NULL OR desconto IS NOT NULL;

-- Log de verificação
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Recalculated valor_total for % sessions with corrected valor_base_pacote', updated_count;
END $$;