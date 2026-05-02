
-- ============================================================
-- Google Calendar Sync — Infrastructure (Fase 1)
-- ============================================================

-- 1. Coluna duração customizável em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMENT ON COLUMN public.appointments.duration_minutes IS
  'Duração em minutos do agendamento. Usado para sincronização com Google Calendar. Fallback 60min se NULL.';

-- 2. Fila de sincronização com Google Calendar
CREATE TABLE IF NOT EXISTS public.google_calendar_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  payload jsonb,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcal_queue_pending
  ON public.google_calendar_sync_queue (next_attempt_at, attempts)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gcal_queue_user_appt
  ON public.google_calendar_sync_queue (user_id, appointment_id);

ALTER TABLE public.google_calendar_sync_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service role manipula a fila
CREATE POLICY "Service role manages sync queue"
  ON public.google_calendar_sync_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Usuários podem ver sua própria fila (debug/UI futura)
CREATE POLICY "Users can view their own sync queue"
  ON public.google_calendar_sync_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Função: enqueue
CREATE OR REPLACE FUNCTION public.enqueue_google_calendar_sync(
  p_appointment_id uuid,
  p_user_id uuid,
  p_action text,
  p_payload jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só enfileira se o usuário tem integração ativa com Google Calendar
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_integracoes
    WHERE user_id = p_user_id
      AND provedor = 'google_calendar'
      AND status = 'ativo'
      AND COALESCE((dados_extras->>'sync_enabled')::boolean, true) = true
  ) THEN
    RETURN;
  END IF;

  -- Coalescing: se já existe item pendente para este appointment + action, atualiza next_attempt_at
  UPDATE public.google_calendar_sync_queue
  SET next_attempt_at = now(),
      attempts = 0,
      last_error = NULL,
      payload = COALESCE(p_payload, payload),
      updated_at = now()
  WHERE appointment_id = p_appointment_id
    AND action = p_action
    AND processed_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.google_calendar_sync_queue (appointment_id, user_id, action, payload)
    VALUES (p_appointment_id, p_user_id, p_action, p_payload);
  END IF;
END;
$$;

-- 4. Trigger em appointments → enfileirar
CREATE OR REPLACE FUNCTION public.appointments_google_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_user_id uuid;
  v_appointment_id uuid;
  v_relevant_change boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_user_id := OLD.user_id;
    v_appointment_id := OLD.id;
    -- Só enfileira delete se havia evento sincronizado
    IF OLD.google_event_id IS NOT NULL THEN
      PERFORM public.enqueue_google_calendar_sync(v_appointment_id, v_user_id, v_action,
        jsonb_build_object('google_event_id', OLD.google_event_id));
    END IF;
    RETURN OLD;
  END IF;

  v_user_id := NEW.user_id;
  v_appointment_id := NEW.id;

  IF TG_OP = 'INSERT' THEN
    -- Só sincroniza se já está confirmado
    IF NEW.status = 'confirmado' THEN
      PERFORM public.enqueue_google_calendar_sync(v_appointment_id, v_user_id, 'create');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  -- Mudança para confirmado (de qualquer outro status) → create
  IF NEW.status = 'confirmado' AND COALESCE(OLD.status, '') <> 'confirmado' THEN
    PERFORM public.enqueue_google_calendar_sync(v_appointment_id, v_user_id, 'create');
    RETURN NEW;
  END IF;

  -- Mudança SAINDO de confirmado → delete
  IF COALESCE(OLD.status, '') = 'confirmado' AND NEW.status <> 'confirmado' THEN
    IF OLD.google_event_id IS NOT NULL THEN
      PERFORM public.enqueue_google_calendar_sync(v_appointment_id, v_user_id, 'delete',
        jsonb_build_object('google_event_id', OLD.google_event_id));
    END IF;
    RETURN NEW;
  END IF;

  -- Update em campos relevantes de appointment já confirmado
  IF NEW.status = 'confirmado' THEN
    IF NEW.date IS DISTINCT FROM OLD.date
       OR NEW.time IS DISTINCT FROM OLD.time
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
    THEN
      v_relevant_change := true;
    END IF;

    IF v_relevant_change THEN
      PERFORM public.enqueue_google_calendar_sync(v_appointment_id, v_user_id, 'update');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_google_sync ON public.appointments;
CREATE TRIGGER trg_appointments_google_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_google_sync_trigger();

-- 5. Updated_at trigger na fila
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_gcal_queue_updated_at ON public.google_calendar_sync_queue;
CREATE TRIGGER trg_gcal_queue_updated_at
  BEFORE UPDATE ON public.google_calendar_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Cron job — a cada 1 minuto, invocar worker
-- Remove job antigo se existir
SELECT cron.unschedule('google-calendar-sync-worker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'google-calendar-sync-worker'
);

SELECT cron.schedule(
  'google-calendar-sync-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/google-calendar-sync-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjU1MDEsImV4cCI6MjA3MzA0MTUwMX0.LR_nMBh8cVY1SQS1TsB7RrGQ1zmCRm_bDvyfI5Dn1QI'
    ),
    body := jsonb_build_object('source','cron','time', now()::text)
  );
  $$
);
