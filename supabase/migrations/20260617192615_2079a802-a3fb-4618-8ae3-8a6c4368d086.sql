
-- ============================================================
-- Agenda Slot Integrity: protege contra agendamentos duplicados
-- e sobre-escrita de horários bloqueados (defesa em profundidade)
-- ============================================================

-- Função: verifica se há slot bloqueado em (user, date, time)
CREATE OR REPLACE FUNCTION public.is_agenda_slot_blocked(
  p_user_id uuid,
  p_date date,
  p_time text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.availability_slots a
    WHERE a.user_id = p_user_id
      AND a.date = p_date
      AND (
        a.is_full_day = true
        OR a.start_time = p_time
      )
      AND (
        a.description ILIKE 'Bloqueado'
        OR a.full_day_description IS NOT NULL
        AND a.is_full_day = true
        AND a.description ILIKE 'Bloqueado'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_agenda_slot_blocked(uuid, date, text) TO authenticated, service_role;

-- Trigger: valida appointments antes de INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.validate_appointment_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_blocked text;
  v_conflict_count int;
BEGIN
  -- Pular validação se não houve mudança de date/time/status em UPDATE
  IF TG_OP = 'UPDATE'
     AND NEW.date = OLD.date
     AND NEW.time = OLD.time
     AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- 1) Bloqueia colisão com agendamento CONFIRMADO de outro registro
  IF NEW.status = 'confirmado' THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.appointments
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND time = NEW.time
      AND status = 'confirmado'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'AGENDA_SLOT_BUSY: Já existe agendamento confirmado neste horário'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 2) Bloqueia gravação sobre slot "Bloqueado", exceto quando explicitamente liberado
  BEGIN
    v_allow_blocked := current_setting('agenda.allow_blocked', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow_blocked := NULL;
  END;

  IF v_allow_blocked IS DISTINCT FROM 'on'
     AND public.is_agenda_slot_blocked(NEW.user_id, NEW.date, NEW.time) THEN
    RAISE EXCEPTION 'AGENDA_SLOT_BLOCKED: Horário bloqueado'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_slot ON public.appointments;
CREATE TRIGGER trg_validate_appointment_slot
  BEFORE INSERT OR UPDATE OF date, time, status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_slot();

-- RPC: desbloqueia um slot e libera próximo INSERT/UPDATE de appointment
-- O front chama esta função imediatamente antes da gravação do agendamento.
-- A sessão fica com agenda.allow_blocked=on até o final da request HTTP.
CREATE OR REPLACE FUNCTION public.agenda_allow_blocked_write(
  p_slot_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_slot_id IS NOT NULL THEN
    DELETE FROM public.availability_slots
    WHERE id = p_slot_id AND user_id = auth.uid();
  END IF;

  PERFORM set_config('agenda.allow_blocked', 'on', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_allow_blocked_write(uuid) TO authenticated;
