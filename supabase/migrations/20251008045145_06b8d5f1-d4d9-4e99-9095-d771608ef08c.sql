-- ✅ FASE 5: Recalcular valor_total para sessões existentes
-- Este script corrige registros que têm valor_total incorreto (apenas valor do pacote)
-- O cálculo correto é: valor_total = valor_base + valor_total_foto_extra + produtos_manuais + valor_adicional - desconto

UPDATE clientes_sessoes 
SET valor_total = COALESCE(valor_total, 0) 
                  + COALESCE(valor_total_foto_extra, 0) 
                  + COALESCE(valor_adicional, 0) 
                  + COALESCE(calculate_manual_products_total(produtos_incluidos), 0)
                  - COALESCE(desconto, 0),
    updated_at = now()
WHERE (
  -- Apenas atualizar se houver discrepância
  COALESCE(valor_total_foto_extra, 0) > 0 
  OR COALESCE(valor_adicional, 0) > 0 
  OR COALESCE(desconto, 0) > 0
  OR COALESCE(calculate_manual_products_total(produtos_incluidos), 0) > 0
);