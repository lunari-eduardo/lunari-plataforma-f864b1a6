-- Adicionando suporte para CRM (Clientes) no compartilhamento de orçamentos
ALTER TABLE public.material_shares
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_material_shares_cliente_id
  ON public.material_shares(cliente_id)
  WHERE cliente_id IS NOT NULL;
