-- Tabela para armazenar horários personalizados por usuário e data
CREATE TABLE IF NOT EXISTS public.custom_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  time_slots TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Garantir apenas um registro por usuário/data
  UNIQUE(user_id, date)
);

-- Índices para performance
CREATE INDEX idx_custom_time_slots_user_date ON public.custom_time_slots(user_id, date);
CREATE INDEX idx_custom_time_slots_user_id ON public.custom_time_slots(user_id);

-- RLS Policies
ALTER TABLE public.custom_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own custom time slots"
  ON public.custom_time_slots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_custom_time_slots_updated_at
  BEFORE UPDATE ON public.custom_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.custom_time_slots IS 'Horários personalizados configurados pelos usuários para cada data na agenda';
COMMENT ON COLUMN public.custom_time_slots.time_slots IS 'Array ordenado de horários no formato HH:mm';