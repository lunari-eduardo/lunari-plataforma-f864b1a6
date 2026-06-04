
-- ============================================================
-- 1) Platform integrations (Asaas assinaturas Lunari etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  scope text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  api_key text NOT NULL,
  last_test_at timestamptz,
  last_test_status text,
  last_test_message text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_integrations_env_chk CHECK (environment IN ('sandbox','production')),
  CONSTRAINT platform_integrations_provider_scope_uniq UNIQUE (provider, scope)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_integrations TO authenticated;
GRANT ALL ON public.platform_integrations TO service_role;

ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;

-- Apenas admins (via has_role já existente no projeto) podem ler/gravar.
DROP POLICY IF EXISTS "Admins manage platform integrations" ON public.platform_integrations;
CREATE POLICY "Admins manage platform integrations"
  ON public.platform_integrations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_platform_integrations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_integrations_updated_at ON public.platform_integrations;
CREATE TRIGGER trg_platform_integrations_updated_at
  BEFORE UPDATE ON public.platform_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_platform_integrations_updated_at();

-- ============================================================
-- 2) Hardening: no máximo 1 integração default ativa por (user, provedor)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_provedor_default_ativo
  ON public.usuarios_integracoes(user_id, provedor)
  WHERE status = 'ativo' AND is_default = true;
