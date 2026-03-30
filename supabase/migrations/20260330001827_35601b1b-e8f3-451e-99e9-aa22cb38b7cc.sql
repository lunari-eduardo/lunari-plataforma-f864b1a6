-- Retroactive fix: cobrança 933c304f com repassarTaxas=true
-- valor_bruto deve ser cobranca.valor/total_parcelas = 50/2 = 25
-- taxa_gateway = max(0, 25 - 25.61) = 0 (cliente pagou as taxas)
UPDATE cobranca_parcelas
SET valor_bruto = 25,
    taxa_gateway = 0,
    updated_at = now()
WHERE cobranca_id = '933c304f-ec5a-44ef-bdf0-d7182111b276';

-- Trigger reconcile_cobranca_from_parcelas will auto-update cobranca.valor_liquido