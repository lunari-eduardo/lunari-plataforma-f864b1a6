-- ========================================
-- MIGRAÇÃO: Sistema de Tarefas para Supabase
-- ========================================

-- 1. Alterar tabela tasks existente para adicionar colunas faltantes
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS active_sections JSONB DEFAULT '["basic"]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS captions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS call_to_action TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS social_platforms TEXT[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS related_cliente_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS related_session_id TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS related_budget_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;

-- 2. Criar tabela task_statuses
CREATE TABLE public.task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Habilitar RLS em task_statuses
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Policy para task_statuses
CREATE POLICY "Users can manage own task statuses" 
ON public.task_statuses 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Criar tabela task_people
CREATE TABLE public.task_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS em task_people
ALTER TABLE public.task_people ENABLE ROW LEVEL SECURITY;

-- Policy para task_people
CREATE POLICY "Users can manage own task people" 
ON public.task_people 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Criar tabela task_tags
CREATE TABLE public.task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS em task_tags
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

-- Policy para task_tags
CREATE POLICY "Users can manage own task tags" 
ON public.task_tags 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para task_statuses
CREATE TRIGGER update_task_statuses_updated_at
BEFORE UPDATE ON public.task_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_task_updated_at();

-- Trigger para task_people
CREATE TRIGGER update_task_people_updated_at
BEFORE UPDATE ON public.task_people
FOR EACH ROW
EXECUTE FUNCTION public.update_task_updated_at();

-- Trigger para task_tags
CREATE TRIGGER update_task_tags_updated_at
BEFORE UPDATE ON public.task_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_task_updated_at();

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_statuses_user_id ON public.task_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_task_people_user_id ON public.task_people(user_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_user_id ON public.task_tags(user_id);

-- 7. Habilitar Realtime nas novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_tags;