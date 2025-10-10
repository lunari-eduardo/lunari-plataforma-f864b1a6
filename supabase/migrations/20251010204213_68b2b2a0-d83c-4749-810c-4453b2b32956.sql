-- FASE 5: Configuração do Supabase para sistema de disponibilidade

-- 5.1: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_availability_slots_user_date 
ON availability_slots(user_id, date);

CREATE INDEX IF NOT EXISTS idx_availability_slots_user_date_time 
ON availability_slots(user_id, date, start_time);

CREATE INDEX IF NOT EXISTS idx_availability_slots_updated_at 
ON availability_slots(updated_at DESC);

-- 5.2: (OPCIONAL) Criar trigger para limpeza automática de slots ocupados
-- Função para limpar slots quando agendamento é confirmado
CREATE OR REPLACE FUNCTION cleanup_occupied_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Se agendamento foi confirmado
  IF NEW.status = 'confirmado' AND (OLD.status IS NULL OR OLD.status != 'confirmado') THEN
    -- Deletar slots de disponibilidade no mesmo horário
    DELETE FROM availability_slots
    WHERE user_id = NEW.user_id
      AND date = NEW.date::date
      AND start_time = NEW.time;
    
    RAISE NOTICE 'Slots ocupados removidos para appointment %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger na tabela appointments
DROP TRIGGER IF EXISTS trigger_cleanup_availability ON appointments;
CREATE TRIGGER trigger_cleanup_availability
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_occupied_availability();

-- 5.3: Habilitar Replica Identity para real-time
ALTER TABLE availability_slots REPLICA IDENTITY FULL;