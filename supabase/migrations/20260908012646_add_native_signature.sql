-- =====================================================
-- NATIVE SIGNATURE SUPPORT FOR CONTRACTS
-- =====================================================

-- Add native signature fields to contratos
ALTER TABLE public.contratos 
  ADD COLUMN signature_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN original_file_path TEXT;

-- Create audit logs table
CREATE TABLE public.contrato_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  geolocation JSONB,
  signed_name TEXT,
  signed_cpf TEXT,
  document_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_contrato_audit_logs_contrato_id ON public.contrato_audit_logs(contrato_id);

-- Enable RLS on the audit logs table
ALTER TABLE public.contrato_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow contract owners to view their audit logs
CREATE POLICY "Users can view audit logs of their own contracts"
  ON public.contrato_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_audit_logs.contrato_id
      AND c.user_id = auth.uid()
    )
  );
