-- ================================
-- ETAPA 1: ESTRUTURA BASE - CLIENTES
-- ================================

-- Tabela principal de clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  email text,
  telefone text NOT NULL,
  whatsapp text,
  endereco text,
  observacoes text,
  origem text,
  data_nascimento date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela família (cônjuge e filhos)
CREATE TABLE public.clientes_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('conjuge', 'filho')), 
  nome text,
  data_nascimento date,
  created_at timestamptz DEFAULT now()
);

-- Tabela documentos/arquivos por cliente  
CREATE TABLE public.clientes_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  tamanho bigint NOT NULL,
  storage_path text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now()
);

-- ================================
-- RLS POLICIES
-- ================================

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_familia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_documentos ENABLE ROW LEVEL SECURITY;

-- Policies para clientes
CREATE POLICY "Users can manage their own clients" 
ON public.clientes 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies para família
CREATE POLICY "Users can manage their own client families" 
ON public.clientes_familia 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies para documentos
CREATE POLICY "Users can manage their own client documents" 
ON public.clientes_documentos 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ================================
-- TRIGGERS PARA updated_at
-- ================================

-- Trigger para clientes
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ================================
-- REAL-TIME SETUP
-- ================================

-- Enable real-time for all client tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_familia;  
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_documentos;

-- Set replica identity for real-time updates
ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER TABLE public.clientes_familia REPLICA IDENTITY FULL;
ALTER TABLE public.clientes_documentos REPLICA IDENTITY FULL;

-- ================================
-- STORAGE BUCKET
-- ================================

-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-documents', 'client-documents', false);

-- Storage policies for client documents
CREATE POLICY "Users can view their own client documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own client documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own client documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own client documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);