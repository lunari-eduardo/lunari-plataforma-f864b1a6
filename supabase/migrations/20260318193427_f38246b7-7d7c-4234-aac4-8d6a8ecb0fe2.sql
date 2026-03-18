ALTER TABLE public.cobranca_parcelas
  ADD COLUMN IF NOT EXISTS data_credito_real timestamptz;