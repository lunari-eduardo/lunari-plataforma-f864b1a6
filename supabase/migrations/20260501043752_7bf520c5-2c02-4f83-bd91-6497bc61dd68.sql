
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('autentique-cron-sync-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'autentique-cron-sync-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/autentique-cron-sync',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjU1MDEsImV4cCI6MjA3MzA0MTUwMX0.LR_nMBh8cVY1SQS1TsB7RrGQ1zmCRm_bDvyfI5Dn1QI"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
