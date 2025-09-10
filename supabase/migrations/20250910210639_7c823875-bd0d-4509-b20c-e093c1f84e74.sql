-- Create missing tables with user isolation and real-time support

-- Create pacotes table
CREATE TABLE IF NOT EXISTS public.pacotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria_id UUID NOT NULL,
  valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_foto_extra DECIMAL(10,2) NOT NULL DEFAULT 0,
  produtos_incluidos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create produtos table  
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create etapas table
CREATE TABLE IF NOT EXISTS public.etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pacotes
CREATE POLICY "Users can view their own pacotes" ON public.pacotes 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pacotes" ON public.pacotes 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pacotes" ON public.pacotes 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pacotes" ON public.pacotes 
FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for produtos
CREATE POLICY "Users can view their own produtos" ON public.produtos 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own produtos" ON public.produtos 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own produtos" ON public.produtos 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own produtos" ON public.produtos 
FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for etapas  
CREATE POLICY "Users can view their own etapas" ON public.etapas 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own etapas" ON public.etapas 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own etapas" ON public.etapas 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own etapas" ON public.etapas 
FOR DELETE USING (auth.uid() = user_id);

-- Add foreign key for pacotes categoria_id
ALTER TABLE public.pacotes 
ADD CONSTRAINT fk_pacotes_categoria 
FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE RESTRICT;

-- Create triggers for updated_at
CREATE TRIGGER update_pacotes_updated_at
BEFORE UPDATE ON public.pacotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON public.produtos  
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_etapas_updated_at
BEFORE UPDATE ON public.etapas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pacotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.etapas;