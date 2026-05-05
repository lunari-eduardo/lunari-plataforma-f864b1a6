-- 1) Tabela de auditoria de mudanças de status de sessões
CREATE TABLE IF NOT EXISTS public.clientes_sessoes_status_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT,
  status_anterior TEXT,
  status_novo TEXT,
  origem TEXT,
  contexto JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_status_audit_sessao ON public.clientes_sessoes_status_audit(sessao_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_status_audit_user ON public.clientes_sessoes_status_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_status_audit_created ON public.clientes_sessoes_status_audit(created_at DESC);

ALTER TABLE public.clientes_sessoes_status_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own session status audit" ON public.clientes_sessoes_status_audit;
CREATE POLICY "Users can view their own session status audit"
ON public.clientes_sessoes_status_audit
FOR SELECT
USING (auth.uid() = user_id);

-- Service role pode inserir (triggers usam SECURITY DEFINER)
DROP POLICY IF EXISTS "Service role manages audit" ON public.clientes_sessoes_status_audit;
CREATE POLICY "Service role manages audit"
ON public.clientes_sessoes_status_audit
FOR ALL
USING (true)
WITH CHECK (true);

-- 2) Função + trigger de auditoria
CREATE OR REPLACE FUNCTION public.log_session_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.clientes_sessoes_status_audit (
      sessao_id, user_id, session_id, status_anterior, status_novo, origem, contexto
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.session_id,
      OLD.status,
      NEW.status,
      COALESCE(current_setting('app.status_change_origin', true), 'unknown'),
      jsonb_build_object(
        'status_galeria_anterior', OLD.status_galeria,
        'status_galeria_novo', NEW.status_galeria
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_session_status_change ON public.clientes_sessoes;
CREATE TRIGGER trg_log_session_status_change
AFTER UPDATE OF status ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.log_session_status_change();

-- 3) Trigger que impede regressão indevida para "Seleção finalizada"
CREATE OR REPLACE FUNCTION public.prevent_session_status_regression_to_selecao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem_selecao INTEGER;
  ordem_atual INTEGER;
  status_protegidos TEXT[] := ARRAY['Editando', 'Enviado Impressão', 'Enviado para impressão', 'Finalizado', 'Entregue'];
BEGIN
  -- Só atua quando o NOVO status é "Seleção finalizada" e o status mudou
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'Seleção finalizada' THEN
    -- 1) Bloqueio por nome conhecido (defesa rápida)
    IF OLD.status = ANY(status_protegidos) THEN
      NEW.status := OLD.status;
      RAISE WARNING '[prevent_status_regression] Preservando status "%". Tentativa de regressão para "Seleção finalizada" bloqueada na sessão %', OLD.status, NEW.id;
      RETURN NEW;
    END IF;

    -- 2) Bloqueio por ordem em etapas_trabalho (cobre status custom)
    SELECT ordem INTO ordem_selecao
    FROM public.etapas_trabalho
    WHERE user_id = NEW.user_id AND nome = 'Seleção finalizada'
    LIMIT 1;

    SELECT ordem INTO ordem_atual
    FROM public.etapas_trabalho
    WHERE user_id = NEW.user_id AND nome = OLD.status
    LIMIT 1;

    IF ordem_selecao IS NOT NULL AND ordem_atual IS NOT NULL AND ordem_atual > ordem_selecao THEN
      NEW.status := OLD.status;
      RAISE WARNING '[prevent_status_regression] Preservando status "%" (ordem %) sobre "Seleção finalizada" (ordem %) na sessão %', OLD.status, ordem_atual, ordem_selecao, NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_session_status_regression ON public.clientes_sessoes;
CREATE TRIGGER trg_prevent_session_status_regression
BEFORE UPDATE OF status ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_session_status_regression_to_selecao();