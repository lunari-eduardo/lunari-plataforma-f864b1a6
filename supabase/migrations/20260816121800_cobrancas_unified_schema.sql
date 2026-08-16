-- Migration: 20260816121800_cobrancas_unified_schema.sql
-- Description: Adiciona colunas normalizadas e índices de idempotência e reconciliação para a tabela cobrancas

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Índice único condicional para garantir idempotência por fotógrafo/operação
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_user_idempotency 
  ON public.cobrancas (user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Índices para reconciliação rápida em webhooks
CREATE INDEX IF NOT EXISTS idx_cobrancas_provider_order 
  ON public.cobrancas (provider_order_id) 
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobrancas_provider_tx 
  ON public.cobrancas (provider_transaction_id) 
  WHERE provider_transaction_id IS NOT NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.cobrancas.idempotency_key IS 'Chave de idempotência única gerada pelo cliente para evitar cobranças duplicadas';
COMMENT ON COLUMN public.cobrancas.provider_order_id IS 'Identificador da ordem ou preferência no gateway (ex: preference_id MP, link_slug IP, payment_id inicial Asaas)';
COMMENT ON COLUMN public.cobrancas.provider_transaction_id IS 'Identificador da transação liquidada no gateway (ex: payment_id MP, transaction_nsu IP)';
COMMENT ON COLUMN public.cobrancas.checkout_url IS 'URL pública canônica do checkout ou link de pagamento';
