-- 1. RLS nas tabelas de log que ainda estavam sem
ALTER TABLE public.webhook_events_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Grants explicitos: nada para anon/authenticated, tudo para service_role
REVOKE ALL ON public.webhook_logs FROM anon, authenticated;
REVOKE ALL ON public.asaas_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.webhook_events_audit FROM anon, authenticated;
REVOKE ALL ON public.system_audit_logs FROM anon, authenticated;

GRANT ALL ON public.webhook_logs TO service_role;
GRANT ALL ON public.asaas_webhook_events TO service_role;
GRANT ALL ON public.webhook_events_audit TO service_role;
GRANT ALL ON public.system_audit_logs TO service_role;

-- 3. Indices de suporte para a retencao
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_created_at
  ON public.asaas_webhook_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_audit_created_at
  ON public.webhook_events_audit USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at
  ON public.system_audit_logs USING btree (created_at DESC);

-- 4. Funcao de retencao
CREATE OR REPLACE FUNCTION public.purge_webhook_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch      integer := 5000;
  v_webhook    integer := 0;
  v_asaas      integer := 0;
  v_audit      integer := 0;
  v_system     integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.webhook_logs
    WHERE id IN (
      SELECT id FROM public.webhook_logs
      WHERE created_at < now() - interval '90 days'
      LIMIT v_batch
    )
    RETURNING 1
  ) SELECT count(*) INTO v_webhook FROM del;

  WITH del AS (
    DELETE FROM public.asaas_webhook_events
    WHERE id IN (
      SELECT id FROM public.asaas_webhook_events
      WHERE created_at < now() - interval '90 days'
      LIMIT v_batch
    )
    RETURNING 1
  ) SELECT count(*) INTO v_asaas FROM del;

  WITH del AS (
    DELETE FROM public.webhook_events_audit
    WHERE id IN (
      SELECT id FROM public.webhook_events_audit
      WHERE created_at < now() - interval '90 days'
      LIMIT v_batch
    )
    RETURNING 1
  ) SELECT count(*) INTO v_audit FROM del;

  WITH del AS (
    DELETE FROM public.system_audit_logs
    WHERE id IN (
      SELECT id FROM public.system_audit_logs
      WHERE created_at < now() - interval '180 days'
      LIMIT v_batch
    )
    RETURNING 1
  ) SELECT count(*) INTO v_system FROM del;

  RETURN jsonb_build_object(
    'executed_at', now(),
    'webhook_logs', v_webhook,
    'asaas_webhook_events', v_asaas,
    'webhook_events_audit', v_audit,
    'system_audit_logs', v_system
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_webhook_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_webhook_logs() TO service_role;

-- 5. Agendamento diario
SELECT cron.unschedule('purge-webhook-logs-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-webhook-logs-daily');

SELECT cron.schedule(
  'purge-webhook-logs-daily',
  '30 3 * * *',
  $cron$ SELECT public.purge_webhook_logs(); $cron$
);