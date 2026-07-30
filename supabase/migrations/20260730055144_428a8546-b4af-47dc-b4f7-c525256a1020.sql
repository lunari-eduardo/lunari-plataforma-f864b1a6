-- ── Onda 4: Scheduler do Automation Engine ───────────────────────────────

-- 1) Regras: configuração do gatilho por tempo
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Runs: rastreio de gatilho + idempotência por janela
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS trigger_kind text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS window_key text;

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_trigger_idem
  ON public.automation_runs (user_id, rule_id, entity_id, window_key)
  WHERE entity_id IS NOT NULL AND window_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS automation_runs_user_created_idx
  ON public.automation_runs (user_id, created_at DESC);

-- 3) Estado do agendador (1 linha por usuário)
CREATE TABLE IF NOT EXISTS public.automation_schedule_state (
  user_id uuid PRIMARY KEY,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_cycle jsonb NOT NULL DEFAULT '{}'::jsonb,
  consecutive_errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.automation_schedule_state TO authenticated;
GRANT ALL ON public.automation_schedule_state TO service_role;
ALTER TABLE public.automation_schedule_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own schedule state" ON public.automation_schedule_state;
CREATE POLICY "own schedule state"
  ON public.automation_schedule_state
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4) Fila de trabalho
CREATE TABLE IF NOT EXISTS public.automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  capability_id text NOT NULL,
  trigger_kind text NOT NULL,
  entity_id text NOT NULL,
  window_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_queue_idem
  ON public.automation_queue (user_id, rule_id, entity_id, window_key);

CREATE INDEX IF NOT EXISTS automation_queue_pending_idx
  ON public.automation_queue (next_attempt_at)
  WHERE processed_at IS NULL;

GRANT SELECT ON public.automation_queue TO authenticated;
GRANT ALL ON public.automation_queue TO service_role;
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own automation queue" ON public.automation_queue;
CREATE POLICY "own automation queue"
  ON public.automation_queue
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5) updated_at trigger no schedule state
DROP TRIGGER IF EXISTS trg_automation_schedule_state_updated ON public.automation_schedule_state;
CREATE TRIGGER trg_automation_schedule_state_updated
  BEFORE UPDATE ON public.automation_schedule_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Painel: visão consolidada por regra (últimos 7 dias)
CREATE OR REPLACE FUNCTION public.automation_schedule_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _state jsonb;
  _rules jsonb;
  _global boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT COALESCE((value)::text = 'true', false) INTO _global
  FROM public.app_settings WHERE key = 'automation_enabled';

  SELECT to_jsonb(s) INTO _state
  FROM public.automation_schedule_state s
  WHERE s.user_id = _uid;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at'), '[]'::jsonb) INTO _rules
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'capability_id', r.capability_id,
      'trigger_kind', r.source_kind,
      'enabled', r.enabled,
      'config', r.config,
      'notes', r.notes,
      'created_at', r.created_at,
      'last_run_at', st.last_run_at,
      'ok', COALESCE(st.ok, 0),
      'failed', COALESCE(st.failed, 0),
      'approval_required', COALESCE(st.approval_required, 0),
      'skipped', COALESCE(st.skipped, 0)
    ) AS x
    FROM public.automation_rules r
    LEFT JOIN LATERAL (
      SELECT
        max(ar.created_at) AS last_run_at,
        count(*) FILTER (WHERE ar.status = 'ok') AS ok,
        count(*) FILTER (WHERE ar.status = 'failed') AS failed,
        count(*) FILTER (WHERE ar.status = 'approval_required') AS approval_required,
        count(*) FILTER (WHERE ar.status IN ('skipped','denied')) AS skipped
      FROM public.automation_runs ar
      WHERE ar.rule_id = r.id
        AND ar.created_at > now() - interval '7 days'
    ) st ON true
    WHERE r.user_id = _uid
  ) q;

  RETURN jsonb_build_object(
    'globalEnabled', COALESCE(_global, false),
    'state', COALESCE(_state, '{}'::jsonb),
    'rules', _rules
  );
END;
$$;

REVOKE ALL ON FUNCTION public.automation_schedule_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.automation_schedule_overview() TO authenticated;