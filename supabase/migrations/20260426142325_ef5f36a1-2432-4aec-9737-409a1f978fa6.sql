-- =====================================================
-- CONTRATO TEMPLATES (modelos reutilizáveis)
-- =====================================================
CREATE TABLE public.contrato_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT DEFAULT 'geral',
  conteudo TEXT NOT NULL DEFAULT '',
  is_padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_templates_user ON public.contrato_templates(user_id);
CREATE INDEX idx_contrato_templates_ativo ON public.contrato_templates(user_id, ativo);

ALTER TABLE public.contrato_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contract templates"
  ON public.contrato_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own contract templates"
  ON public.contrato_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own contract templates"
  ON public.contrato_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own contract templates"
  ON public.contrato_templates FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- CONTRATOS (instâncias geradas)
-- =====================================================
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id TEXT,
  template_id UUID REFERENCES public.contrato_templates(id) ON DELETE SET NULL,
  
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  variaveis_snapshot JSONB DEFAULT '{}'::jsonb,
  
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','assinado','cancelado')),
  
  -- Upload manual do PDF assinado
  arquivo_assinado_path TEXT,
  arquivo_assinado_nome TEXT,
  arquivo_assinado_tamanho BIGINT,
  
  -- Reservado para futura assinatura digital (Autentique etc.)
  signature_provider TEXT,
  signature_external_id TEXT,
  signers JSONB DEFAULT '[]'::jsonb,
  
  enviado_em TIMESTAMPTZ,
  assinado_em TIMESTAMPTZ,
  
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratos_user ON public.contratos(user_id);
CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE INDEX idx_contratos_session ON public.contratos(session_id);
CREATE INDEX idx_contratos_status ON public.contratos(user_id, status);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contracts"
  ON public.contratos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own contracts"
  ON public.contratos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own contracts"
  ON public.contratos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own contracts"
  ON public.contratos FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Atualizar updated_at automaticamente
CREATE TRIGGER trg_contrato_templates_updated_at
  BEFORE UPDATE ON public.contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bloquear edição do conteúdo quando o contrato estiver assinado
CREATE OR REPLACE FUNCTION public.prevent_signed_contract_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'assinado' AND NEW.status = 'assinado' THEN
    -- Permitir apenas anexar arquivo, atualizar observacoes ou alterar status para cancelado
    IF NEW.conteudo IS DISTINCT FROM OLD.conteudo
       OR NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.variaveis_snapshot IS DISTINCT FROM OLD.variaveis_snapshot THEN
      RAISE EXCEPTION 'Não é possível alterar o conteúdo de um contrato já assinado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_signed_contract_edit
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_signed_contract_edit();

-- =====================================================
-- STORAGE: bucket privado para contratos assinados
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-assinados', 'contratos-assinados', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view their own signed contracts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contratos-assinados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own signed contracts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contratos-assinados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own signed contracts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'contratos-assinados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own signed contracts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contratos-assinados' AND auth.uid()::text = (storage.foldername(name))[1]);