-- Fase 1: Sincronização Automática de Datas entre Appointments e Workflow

-- 1.1 - Criar Função de Sincronização
CREATE OR REPLACE FUNCTION public.sync_appointment_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só sincronizar se appointment estiver confirmado E tiver id válido
  IF NEW.status = 'confirmado' AND NEW.id IS NOT NULL THEN
    UPDATE public.clientes_sessoes
    SET 
      data_sessao = NEW.date,
      hora_sessao = NEW.time,
      updated_at = now()
    WHERE appointment_id = NEW.id
      AND user_id = NEW.user_id;
      
    -- Log para debug
    RAISE NOTICE 'Synced appointment % to session: date=%, time=%', NEW.id, NEW.date, NEW.time;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 1.2 - Criar Trigger AFTER UPDATE
DROP TRIGGER IF EXISTS sync_appointment_date_to_session ON public.appointments;

CREATE TRIGGER sync_appointment_date_to_session
  AFTER UPDATE OF date, time ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado')
  EXECUTE FUNCTION public.sync_appointment_to_session();

-- 1.3 - Criar Índice para Performance
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_appointment_id 
ON public.clientes_sessoes(appointment_id) 
WHERE appointment_id IS NOT NULL;