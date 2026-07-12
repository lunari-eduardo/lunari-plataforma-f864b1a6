ALTER TABLE public.cobranca_parcelas
  ADD CONSTRAINT cobranca_parcelas_asaas_payment_id_key
  UNIQUE (asaas_payment_id);