-- =============================================
-- MIGRAÇÃO: Sistema de Precificação para Supabase
-- =============================================

-- 1. Tabela de Gastos Pessoais
CREATE TABLE IF NOT EXISTS public.pricing_gastos_pessoais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Custos de Estúdio
CREATE TABLE IF NOT EXISTS public.pricing_custos_estudio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  origem TEXT DEFAULT 'manual',
  fin_item_id UUID REFERENCES public.fin_items_master(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Equipamentos (com depreciação calculada)
CREATE TABLE IF NOT EXISTS public.pricing_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  vida_util INTEGER NOT NULL DEFAULT 5,
  fin_transaction_id UUID REFERENCES public.fin_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Configurações (pró-labore, horas, metas)
CREATE TABLE IF NOT EXISTS public.pricing_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  percentual_pro_labore NUMERIC DEFAULT 30,
  horas_disponiveis INTEGER DEFAULT 8,
  dias_trabalhados INTEGER DEFAULT 5,
  margem_lucro_desejada NUMERIC DEFAULT 30,
  ano_meta INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  meta_faturamento_anual NUMERIC DEFAULT 0,
  meta_lucro_anual NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Estados da Calculadora
CREATE TABLE IF NOT EXISTS public.pricing_calculadora_estados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT,
  horas_estimadas NUMERIC DEFAULT 0,
  markup NUMERIC DEFAULT 2,
  produtos JSONB DEFAULT '[]'::jsonb,
  custos_extras JSONB DEFAULT '[]'::jsonb,
  custo_total_calculado NUMERIC DEFAULT 0,
  preco_final_calculado NUMERIC DEFAULT 0,
  lucratividade NUMERIC DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Índices para performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_pricing_gastos_user ON public.pricing_gastos_pessoais(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_custos_user ON public.pricing_custos_estudio(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_custos_fin_item ON public.pricing_custos_estudio(fin_item_id);
CREATE INDEX IF NOT EXISTS idx_pricing_equipamentos_user ON public.pricing_equipamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_equipamentos_fin_tx ON public.pricing_equipamentos(fin_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pricing_calculadora_user ON public.pricing_calculadora_estados(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_calculadora_default ON public.pricing_calculadora_estados(user_id, is_default) WHERE is_default = true;

-- =============================================
-- RLS Policies
-- =============================================

-- Gastos Pessoais
ALTER TABLE public.pricing_gastos_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pricing gastos" ON public.pricing_gastos_pessoais;
CREATE POLICY "Users manage own pricing gastos" ON public.pricing_gastos_pessoais
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Custos Estúdio
ALTER TABLE public.pricing_custos_estudio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pricing custos estudio" ON public.pricing_custos_estudio;
CREATE POLICY "Users manage own pricing custos estudio" ON public.pricing_custos_estudio
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Equipamentos
ALTER TABLE public.pricing_equipamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pricing equipamentos" ON public.pricing_equipamentos;
CREATE POLICY "Users manage own pricing equipamentos" ON public.pricing_equipamentos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Configurações
ALTER TABLE public.pricing_configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pricing config" ON public.pricing_configuracoes;
CREATE POLICY "Users manage own pricing config" ON public.pricing_configuracoes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calculadora Estados
ALTER TABLE public.pricing_calculadora_estados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pricing calculadora" ON public.pricing_calculadora_estados;
CREATE POLICY "Users manage own pricing calculadora" ON public.pricing_calculadora_estados
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Triggers de updated_at
-- =============================================
DROP TRIGGER IF EXISTS update_pricing_gastos_pessoais_updated_at ON public.pricing_gastos_pessoais;
CREATE TRIGGER update_pricing_gastos_pessoais_updated_at
  BEFORE UPDATE ON public.pricing_gastos_pessoais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_custos_estudio_updated_at ON public.pricing_custos_estudio;
CREATE TRIGGER update_pricing_custos_estudio_updated_at
  BEFORE UPDATE ON public.pricing_custos_estudio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_equipamentos_updated_at ON public.pricing_equipamentos;
CREATE TRIGGER update_pricing_equipamentos_updated_at
  BEFORE UPDATE ON public.pricing_equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_configuracoes_updated_at ON public.pricing_configuracoes;
CREATE TRIGGER update_pricing_configuracoes_updated_at
  BEFORE UPDATE ON public.pricing_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_calculadora_estados_updated_at ON public.pricing_calculadora_estados;
CREATE TRIGGER update_pricing_calculadora_estados_updated_at
  BEFORE UPDATE ON public.pricing_calculadora_estados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Enable Realtime para detecção de equipamentos
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_equipamentos;