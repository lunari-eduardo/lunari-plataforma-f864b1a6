-- Força recálculo de valor_total nas sessões com fotos extras recém-preenchidas
UPDATE public.clientes_sessoes
SET valor_adicional = valor_adicional
WHERE qtd_fotos_extra > 0
  AND valor_total_foto_extra > 0
  AND valor_total < COALESCE(valor_base_pacote, 0) + valor_total_foto_extra + COALESCE(valor_adicional, 0) - COALESCE(desconto, 0);