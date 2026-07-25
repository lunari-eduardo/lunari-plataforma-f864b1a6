
-- app_settings (global key/value config)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings readable by authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings writable by admins"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- assistant_beta_access
CREATE TABLE public.assistant_beta_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text
);
GRANT SELECT ON public.assistant_beta_access TO authenticated;
GRANT ALL ON public.assistant_beta_access TO service_role;
ALTER TABLE public.assistant_beta_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beta sees own row"
  ON public.assistant_beta_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "beta admin manages"
  ON public.assistant_beta_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default stage = admin
INSERT INTO public.app_settings (key, value)
VALUES ('assistant_rollout_stage', '"admin"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RPC: is Lu allowed for this user under the current stage?
CREATE OR REPLACE FUNCTION public.assistant_access_allowed(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage text;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  SELECT (value #>> '{}') INTO stage
  FROM public.app_settings
  WHERE key = 'assistant_rollout_stage';

  IF stage IS NULL THEN stage := 'admin'; END IF;

  IF stage = 'geral' THEN
    RETURN true;
  ELSIF stage = 'beta' THEN
    RETURN public.has_role(_uid, 'admin')
      OR EXISTS (SELECT 1 FROM public.assistant_beta_access WHERE user_id = _uid);
  ELSIF stage = 'admin' THEN
    RETURN public.has_role(_uid, 'admin');
  END IF;

  RETURN false; -- fail-closed
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_access_allowed(uuid) TO authenticated, anon, service_role;
