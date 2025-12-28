-- ===========================================
-- FASE 1: MIGRAÇÃO DO SISTEMA DE LEADS
-- ===========================================

-- 1.1 Expandir tabela leads existente
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS interacoes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz,
ADD COLUMN IF NOT EXISTS dias_sem_interacao integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS needs_follow_up boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status_timestamp timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS needs_scheduling boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_appointment_id text,
ADD COLUMN IF NOT EXISTS motivo_perda text,
ADD COLUMN IF NOT EXISTS perdido_em timestamptz,
ADD COLUMN IF NOT EXISTS historico_status jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS arquivado boolean DEFAULT false;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_cliente_id ON leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON leads(arquivado);
CREATE INDEX IF NOT EXISTS idx_leads_needs_follow_up ON leads(needs_follow_up) WHERE needs_follow_up = true;

-- 1.2 Criar tabela lead_statuses
CREATE TABLE IF NOT EXISTS lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text DEFAULT '#6b7280',
  is_converted boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);

-- RLS para lead_statuses
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lead statuses" ON lead_statuses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at em lead_statuses
CREATE TRIGGER lead_statuses_updated_at
  BEFORE UPDATE ON lead_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.3 Criar tabela lead_follow_up_config
CREATE TABLE IF NOT EXISTS lead_follow_up_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  dias_para_follow_up integer DEFAULT 3,
  ativo boolean DEFAULT true,
  status_monitorado text DEFAULT 'orcamento_enviado',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para lead_follow_up_config
ALTER TABLE lead_follow_up_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follow up config" ON lead_follow_up_config
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at em lead_follow_up_config
CREATE TRIGGER lead_follow_up_config_updated_at
  BEFORE UPDATE ON lead_follow_up_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.4 Função para calcular dias sem interação automaticamente
CREATE OR REPLACE FUNCTION update_lead_dias_sem_interacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ultima_interacao IS NOT NULL THEN
    NEW.dias_sem_interacao := EXTRACT(DAY FROM (now() - NEW.ultima_interacao))::integer;
  ELSE
    NEW.dias_sem_interacao := EXTRACT(DAY FROM (now() - NEW.created_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leads_calculate_dias_sem_interacao
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_dias_sem_interacao();

-- 1.5 Função para atualizar status_timestamp quando status muda
CREATE OR REPLACE FUNCTION update_lead_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_timestamp := now();
    -- Adicionar ao histórico de status
    NEW.historico_status := COALESCE(NEW.historico_status, '[]'::jsonb) || 
      jsonb_build_object(
        'status', NEW.status,
        'data', now()::text
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leads_status_change
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_status_timestamp();