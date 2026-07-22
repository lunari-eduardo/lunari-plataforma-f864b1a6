-- Índices de suporte para confirm-payment-manual (Studio)
CREATE INDEX IF NOT EXISTS idx_cobrancas_galeria_pendente
  ON public.cobrancas (galeria_id, status)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_cobrancas_session_extras_pendente
  ON public.cobrancas (session_id, finalidade, status)
  WHERE status = 'pendente' AND finalidade IN ('fotos_extras','sessao_e_extras');

-- Idempotência transação↔cobrança manual (evita duplo lançamento Studio↔Gallery).
-- Filtro restrito a transações de tipo pagamento com descrição de origem manual
-- para não colidir com parcelamentos digitais legados (Asaas, etc.) que compartilham cobranca_id.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_transacoes_manual_por_cobranca
  ON public.clientes_transacoes (cobranca_id)
  WHERE cobranca_id IS NOT NULL
    AND tipo = 'pagamento'
    AND (descricao ILIKE '%[MANUAL]%' OR descricao ILIKE '%(cobranca %');
