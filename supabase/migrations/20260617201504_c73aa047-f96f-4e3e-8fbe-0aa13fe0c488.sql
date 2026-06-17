-- Robustecer detecção de slot bloqueado e RPC de desbloqueio

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
        OR substring(a.start_time::text from 1 for 5) = substring(p_time from 1 for 5)
      )
      AND (
        a.description ILIKE 'bloqueado%'
        OR a.type ILIKE 'bloqueado%'
        OR (a.is_full_day = true AND a.full_day_description IS NOT NULL)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_agenda_slot_blocked(uuid, date, text) TO authenticated, service_role;

-- Nova assinatura: aceita full-day e date para limpar todos os bloqueios do dia
CREATE OR REPLACE FUNCTION public.agenda_allow_blocked_write(
  p_slot_id uuid DEFAULT NULL,
  p_full_day boolean DEFAULT false,
  p_date date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_full_day = true AND p_date IS NOT NULL THEN
    DELETE FROM public.availability_slots
    WHERE user_id = auth.uid()
      AND date = p_date
      AND (
        description ILIKE 'bloqueado%'
        OR type ILIKE 'bloqueado%'
        OR (is_full_day = true AND full_day_description IS NOT NULL)
      );
  ELSIF p_slot_id IS NOT NULL THEN
    DELETE FROM public.availability_slots
    WHERE id = p_slot_id AND user_id = auth.uid();
  END IF;

  PERFORM set_config('agenda.allow_blocked', 'on', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_allow_blocked_write(uuid, boolean, date) TO authenticated;