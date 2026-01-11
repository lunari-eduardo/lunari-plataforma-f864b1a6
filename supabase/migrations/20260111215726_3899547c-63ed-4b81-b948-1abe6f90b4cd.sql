-- Adicionar colunas para suportar InfinitePay na tabela cobrancas
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS provedor TEXT DEFAULT 'mercadopago';
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS ip_checkout_url TEXT;
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS ip_order_nsu TEXT;
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS ip_transaction_nsu TEXT;
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS ip_receipt_url TEXT;

-- Índice para busca rápida por order_nsu (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_cobrancas_ip_order_nsu ON cobrancas(ip_order_nsu) WHERE ip_order_nsu IS NOT NULL;

-- Índice para busca por provedor
CREATE INDEX IF NOT EXISTS idx_cobrancas_provedor ON cobrancas(provedor);

-- Comentários para documentação
COMMENT ON COLUMN cobrancas.provedor IS 'Provedor de pagamento: mercadopago ou infinitepay';
COMMENT ON COLUMN cobrancas.ip_checkout_url IS 'URL do checkout InfinitePay';
COMMENT ON COLUMN cobrancas.ip_order_nsu IS 'NSU do pedido InfinitePay (usado para identificar no webhook)';
COMMENT ON COLUMN cobrancas.ip_transaction_nsu IS 'NSU da transação InfinitePay (retornado no webhook)';
COMMENT ON COLUMN cobrancas.ip_receipt_url IS 'URL do comprovante InfinitePay';