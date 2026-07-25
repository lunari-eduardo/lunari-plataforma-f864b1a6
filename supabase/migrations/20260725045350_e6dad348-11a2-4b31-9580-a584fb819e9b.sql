
-- Estado do pedido: aguardando decisão / aprovado (com token consumível) / negado / expirado / consumido.
CREATE TYPE public.assistant_approval_status AS ENUM ('pending','approved','denied','expired','consumed');

CREATE TABLE public.assistant_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_id UUID REFERENCES public.assistant_mcp_tokens(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  status public.assistant_approval_status NOT NULL DEFAULT 'pending',
  approval_token_hash TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_assistant_approvals_user_status ON public.assistant_approvals(user_id, status);
CREATE INDEX ix_assistant_approvals_expires ON public.assistant_approvals(expires_at) WHERE status = 'pending';

GRANT SELECT ON public.assistant_approvals TO authenticated;
GRANT ALL ON public.assistant_approvals TO service_role;
ALTER TABLE public.assistant_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own approvals"
  ON public.assistant_approvals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fotógrafo decide (aprovar/negar) apenas seus próprios pedidos e apenas se estiverem pending.
CREATE OR REPLACE FUNCTION public.assistant_approval_decide(
  _id UUID,
  _approve BOOLEAN
) RETURNS public.assistant_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.assistant_approvals;
  v_uid UUID := auth.uid();
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT * INTO v_row FROM public.assistant_approvals WHERE id = _id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval_not_found';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'approval_already_decided:%', v_row.status;
  END IF;
  IF v_row.expires_at < now() THEN
    UPDATE public.assistant_approvals SET status = 'expired', decided_at = now()
      WHERE id = _id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF _approve THEN
    v_token := 'lapr_' || encode(gen_random_bytes(24), 'hex');
    UPDATE public.assistant_approvals
      SET status = 'approved',
          decided_at = now(),
          approval_token_hash = encode(digest(v_token, 'sha256'), 'hex')
      WHERE id = _id RETURNING * INTO v_row;
    -- devolve o token cru uma única vez via coluna virtual
    v_row.approval_token_hash := v_token;
  ELSE
    UPDATE public.assistant_approvals
      SET status = 'denied', decided_at = now()
      WHERE id = _id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_approval_decide(UUID, BOOLEAN) TO authenticated;

-- Service role: criar um pedido a partir do MCP.
CREATE OR REPLACE FUNCTION public.assistant_approval_create(
  _user_id UUID,
  _token_id UUID,
  _tool_name TEXT,
  _tool_args JSONB,
  _summary TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.assistant_approvals(user_id, token_id, tool_name, tool_args, summary)
  VALUES (_user_id, _token_id, _tool_name, COALESCE(_tool_args,'{}'::jsonb), _summary)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_approval_create(UUID,UUID,TEXT,JSONB,TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.assistant_approval_create(UUID,UUID,TEXT,JSONB,TEXT) TO service_role;

-- Service role: valida e consome um approval_token (single-use) para uma tool específica.
CREATE OR REPLACE FUNCTION public.assistant_approval_consume(
  _approval_token TEXT,
  _user_id UUID,
  _tool_name TEXT
) RETURNS TABLE(approval_id UUID, tool_args JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := encode(digest(_approval_token, 'sha256'), 'hex');
  v_row public.assistant_approvals;
BEGIN
  SELECT * INTO v_row FROM public.assistant_approvals
   WHERE approval_token_hash = v_hash
     AND user_id = _user_id
     AND tool_name = _tool_name
     AND status = 'approved'
     AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.assistant_approvals
    SET status = 'consumed', consumed_at = now()
    WHERE id = v_row.id;
  approval_id := v_row.id;
  tool_args := v_row.tool_args;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_approval_consume(TEXT,UUID,TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.assistant_approval_consume(TEXT,UUID,TEXT) TO service_role;
