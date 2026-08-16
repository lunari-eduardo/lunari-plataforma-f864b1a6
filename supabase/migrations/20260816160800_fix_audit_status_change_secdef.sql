-- Migration: 20260816160800_fix_audit_status_change_secdef.sql
-- Fix: Tornar audit_status_change() SECURITY DEFINER para permitir cancelamento/atualização de status por usuários autenticados sem bloqueio de RLS em system_audit_logs

CREATE OR REPLACE FUNCTION public.audit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.system_audit_logs (
            correlation_id,
            event_type,
            source,
            source_name,
            gallery_id,
            payload
        ) VALUES (
            public.get_current_correlation_id(),
            'STATUS_CHANGE',
            'trigger',
            TG_NAME,
            CASE WHEN TG_TABLE_NAME = 'galerias' THEN NEW.id ELSE NULL END,
            jsonb_build_object(
                'table', TG_TABLE_NAME,
                'id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$function$;
