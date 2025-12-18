-- Tabela de cobranças (integração Mercado Pago)
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id TEXT,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  tipo_cobranca TEXT NOT NULL CHECK (tipo_cobranca IN ('pix', 'link', 'card', 'presencial')),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'expirado')),
  
  -- Dados do Mercado Pago
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  mp_qr_code TEXT,
  mp_qr_code_base64 TEXT,
  mp_pix_copia_cola TEXT,
  mp_payment_link TEXT,
  mp_expiration_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  data_pagamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cobrancas_user_id ON public.cobrancas(user_id);
CREATE INDEX idx_cobrancas_cliente_id ON public.cobrancas(cliente_id);
CREATE INDEX idx_cobrancas_session_id ON public.cobrancas(session_id);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);

-- RLS
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own charges"
ON public.cobrancas
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cobrancas_updated_at
BEFORE UPDATE ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();