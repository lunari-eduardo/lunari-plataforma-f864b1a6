
-- ============================================================================
-- Onda 3+2+6 — Estabilização de "A Receber": RPC canônica + trigger de
-- blindagem Gallery→Studio + normalização de sessões sem status
-- ============================================================================

-- 3) RPC canônica "workflow_a_receber": única fonte de verdade
--    Fórmula: Σ GREATEST(valor_total - valor_pago, 0) por sessão,
--    excluindo 'historico' (mas incluindo '' e NULL), apenas workflow.
CREATE OR REPLACE FUNCTION public.workflow_a_receber(
  _start date,
  _end date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(GREATEST(
    COALESCE(valor_total, 0) - COALESCE(valor_pago, 0),
    0
  )), 0)::numeric
  FROM public.clientes_sessoes
  WHERE user_id = auth.uid()
    AND data_sessao BETWEEN _start AND _end
    AND (status IS DISTINCT FROM 'historico')
    AND COALESCE(tipo_registro, 'workflow') = 'workflow';
$$;

GRANT EXECUTE ON FUNCTION public.workflow_a_receber(date, date) TO authenticated;

-- 2) Blindagem: quando uma cobrança de fotos_extras é marcada como paga,
--    sincronizar automaticamente qtd_fotos_extra e valor_total_foto_extra
--    na sessão vinculada. Fonte de verdade = a própria cobrança
--    (NEW.qtd_fotos e NEW.valor), garantindo atomicidade mesmo se o
--    Gallery não chamar gallery-update-session-photos.
CREATE OR REPLACE FUNCTION public.sync_session_extras_from_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qtd integer;
  v_valor numeric;
  v_unit numeric;
BEGIN
  -- Só age quando: passou para 'pago', finalidade correta, e temos os IDs
  IF NEW.status <> 'pago' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.finalidade, '') <> 'fotos_extras' THEN RETURN NEW; END IF;
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;

  -- Só age na transição de status (evita reprocessar em UPDATEs cosméticos)
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;

  v_qtd := COALESCE(NEW.qtd_fotos, 0);
  v_valor := COALESCE(NEW.valor, 0);

  IF v_qtd <= 0 OR v_valor <= 0 THEN RETURN NEW; END IF;

  v_unit := ROUND(v_valor / v_qtd, 2);

  -- Atualiza a sessão. Só preenche se ainda estiver zerada, para não
  -- sobrescrever ajuste manual válido nem duplicar em cobranças múltiplas.
  UPDATE public.clientes_sessoes
     SET qtd_fotos_extra = v_qtd,
         valor_foto_extra = v_unit,
         valor_total_foto_extra = v_valor,
         galeria_id = COALESCE(galeria_id, NEW.galeria_id),
         extras_overridden = false,
         extras_overridden_at = NULL,
         updated_at = now()
   WHERE session_id = NEW.session_id
     AND COALESCE(qtd_fotos_extra, 0) = 0
     AND COALESCE(valor_total_foto_extra, 0) = 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_session_extras_from_cobranca ON public.cobrancas;
CREATE TRIGGER trg_sync_session_extras_from_cobranca
AFTER INSERT OR UPDATE OF status ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.sync_session_extras_from_cobranca();

-- 6) Normalização de sessões criadas sem status:
--    trigger BEFORE INSERT que aplica a primeira etapa do usuário quando
--    o payload chega com status NULL ou vazio. Isso fecha a origem do
--    problema (agenda criando sessões sem status).
CREATE OR REPLACE FUNCTION public.default_session_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default text;
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status <> '' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_default
  FROM public.etapas_trabalho
  WHERE user_id = NEW.user_id
  ORDER BY ordem ASC NULLS LAST, created_at ASC
  LIMIT 1;

  NEW.status := COALESCE(v_default, 'Novo lead');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_session_status ON public.clientes_sessoes;
CREATE TRIGGER trg_default_session_status
BEFORE INSERT ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.default_session_status();
