-- =====================================================================
-- A5 — Aprovação humana e auditoria
-- =====================================================================

-- 1) assistant_invocations: contrato completo (app + MCP + anônimo)
ALTER TABLE public.assistant_invocations
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.assistant_invocations
  ADD COLUMN IF NOT EXISTS surface        text,
  ADD COLUMN IF NOT EXISTS tool_name      text,
  ADD COLUMN IF NOT EXISTS client_id      text,
  ADD COLUMN IF NOT EXISTS required_tier  text,
  ADD COLUMN IF NOT EXISTS granted_tiers  text[],
  ADD COLUMN IF NOT EXISTS request_id     text,
  ADD COLUMN IF NOT EXISTS approval_id    uuid REFERENCES public.assistant_approvals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_invocations_user_ts
  ON public.assistant_invocations(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_invocations_status_ts
  ON public.assistant_invocations(output_status, ts DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_invocations_approval
  ON public.assistant_invocations(approval_id) WHERE approval_id IS NOT NULL;

-- RLS: usuário só lê as próprias linhas; anônimas ficam para service_role.
DROP POLICY IF EXISTS "Users read own invocations" ON public.assistant_invocations;
CREATE POLICY "Users read own invocations" ON public.assistant_invocations
  FOR SELECT TO authenticated USING (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own invocations" ON public.assistant_invocations;
CREATE POLICY "Users insert own invocations" ON public.assistant_invocations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 2) assistant_approvals: origem, modo de confirmação e anti-duplicidade
ALTER TABLE public.assistant_approvals
  ADD COLUMN IF NOT EXISTS surface           text NOT NULL DEFAULT 'mcp',
  ADD COLUMN IF NOT EXISTS client_id         text,
  ADD COLUMN IF NOT EXISTS confirmation_mode text,
  ADD COLUMN IF NOT EXISTS args_fingerprint  text;

UPDATE public.assistant_approvals
   SET args_fingerprint = md5(tool_args::text)
 WHERE args_fingerprint IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_assistant_approvals_pending
  ON public.assistant_approvals(user_id, tool_name, args_fingerprint)
  WHERE status = 'pending';

-- 3) Criação idempotente do pedido (reaproveita pendente idêntico)
CREATE OR REPLACE FUNCTION public.assistant_approval_create(
  _user_id   uuid,
  _token_id  uuid,
  _tool_name text,
  _tool_args jsonb,
  _summary   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id   uuid;
  v_args jsonb := COALESCE(_tool_args, '{}'::jsonb);
  v_fp   text  := md5(COALESCE(_tool_args, '{}'::jsonb)::text);
BEGIN
  -- Expira pendentes vencidos antes de reaproveitar.
  UPDATE public.assistant_approvals
     SET status = 'expired', decided_at = now()
   WHERE user_id = _user_id AND status = 'pending' AND expires_at < now();

  SELECT id INTO v_id
    FROM public.assistant_approvals
   WHERE user_id = _user_id
     AND tool_name = _tool_name
     AND args_fingerprint = v_fp
     AND status = 'pending'
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.assistant_approvals(
    user_id, token_id, tool_name, tool_args, summary, args_fingerprint
  )
  VALUES (_user_id, _token_id, _tool_name, v_args, _summary, v_fp)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_approval_create(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_approval_create(uuid, uuid, text, jsonb, text) TO service_role;

-- 3b) Variante para a Lu dentro do app: cria o ticket já resolvido pelo próprio
-- usuário (confirmação inline por texto/voz) e devolve o id para auditoria.
CREATE OR REPLACE FUNCTION public.assistant_approval_record_inline(
  _tool_name         text,
  _tool_args         jsonb,
  _summary           text,
  _confirmation_mode text,
  _approved          boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.assistant_approvals(
    user_id, tool_name, tool_args, summary, surface, confirmation_mode,
    args_fingerprint, status, decided_at, consumed_at
  )
  VALUES (
    v_uid, _tool_name, COALESCE(_tool_args, '{}'::jsonb), _summary, 'app', _confirmation_mode,
    md5(COALESCE(_tool_args, '{}'::jsonb)::text),
    CASE WHEN _approved THEN 'consumed'::assistant_approval_status ELSE 'denied'::assistant_approval_status END,
    now(),
    CASE WHEN _approved THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_approval_record_inline(text, jsonb, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_approval_record_inline(text, jsonb, text, text, boolean) TO authenticated;

-- 4) Varredura de vencidos (chamada pela fila e por agendamento)
CREATE OR REPLACE FUNCTION public.assistant_approvals_expire_stale()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  UPDATE public.assistant_approvals
     SET status = 'expired', decided_at = now()
   WHERE user_id = v_uid AND status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_approvals_expire_stale() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_approvals_expire_stale() TO authenticated;