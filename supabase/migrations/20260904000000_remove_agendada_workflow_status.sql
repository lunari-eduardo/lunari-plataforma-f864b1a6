-- ==============================================================================
-- Migration: 20260904000000_remove_agendada_workflow_status.sql
-- Objetivo: Garantir que novas sessões criadas no Workflow venham SEM STATUS (NULL),
--           pois as etapas de produção interna são iniciadas manualmente pela equipe.
-- 1. Remover DEFAULT 'agendado' da coluna clientes_sessoes.status
-- 2. Atualizar trigger ensure_workflow_session_on_confirm() para não injetar 'agendada'
-- 3. Limpar sessões existentes que ficaram com 'agendada' ou 'agendado'
-- ==============================================================================

-- 1. Remover default legado da coluna status
ALTER TABLE public.clientes_sessoes ALTER COLUMN status DROP DEFAULT;

-- 2. Atualizar a função da trigger de confirmação de agendamento
CREATE OR REPLACE FUNCTION public.ensure_workflow_session_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_pkg RECORD;
  v_categoria TEXT;
  v_valor_base NUMERIC := 0;
BEGIN
  IF COALESCE(NEW.status, '') <> 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF NEW.session_id IS NULL OR NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.package_id IS NOT NULL AND NEW.package_id <> '' THEN
    BEGIN
      SELECT p.*, c.nome AS categoria_nome
        INTO v_pkg
        FROM public.pacotes p
        LEFT JOIN public.categorias c ON c.id = p.categoria_id
       WHERE p.id::text = NEW.package_id
         AND p.user_id = NEW.user_id
       LIMIT 1;
    EXCEPTION WHEN others THEN
      v_pkg := NULL;
    END;
  END IF;

  v_categoria := COALESCE(NULLIF(v_pkg.categoria_nome, ''), NULLIF(NEW.type, ''), 'Sessão');
  v_valor_base := COALESCE(v_pkg.valor_base, 0);

  SELECT * INTO v_session
    FROM public.clientes_sessoes
   WHERE user_id = NEW.user_id
     AND (appointment_id = NEW.id OR session_id = NEW.session_id)
   LIMIT 1;

  IF v_session.id IS NULL THEN
    INSERT INTO public.clientes_sessoes (
      user_id, cliente_id, session_id, appointment_id, data_sessao, hora_sessao,
      categoria, pacote, descricao, status, valor_total, valor_base_pacote,
      valor_pago, valor_foto_extra, produtos_incluidos, tipo_registro
    ) VALUES (
      NEW.user_id, NEW.cliente_id, NEW.session_id, NEW.id, NEW.date, NEW.time,
      v_categoria, v_pkg.nome, NEW.description, NULL,
      GREATEST(v_valor_base, COALESCE(NEW.paid_amount, 0)), v_valor_base,
      0, COALESCE(v_pkg.valor_foto_extra, 0), COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb), 'workflow'
    );
  ELSE
    UPDATE public.clientes_sessoes s
       SET appointment_id = COALESCE(s.appointment_id, NEW.id),
           categoria = CASE WHEN COALESCE(s.categoria, '') IN ('', 'Sessão') THEN v_categoria ELSE s.categoria END,
           pacote = COALESCE(NULLIF(s.pacote, ''), v_pkg.nome),
           descricao = COALESCE(NULLIF(s.descricao, ''), NEW.description),
           status = CASE WHEN COALESCE(s.status, '') IN ('', 'stub') THEN NULL ELSE s.status END,
           valor_base_pacote = CASE WHEN COALESCE(s.valor_base_pacote, 0) = 0 THEN v_valor_base ELSE s.valor_base_pacote END,
           valor_total = GREATEST(COALESCE(s.valor_total, 0), v_valor_base),
           valor_foto_extra = CASE WHEN COALESCE(s.valor_foto_extra, 0) = 0 THEN COALESCE(v_pkg.valor_foto_extra, 0) ELSE s.valor_foto_extra END,
           produtos_incluidos = CASE WHEN s.produtos_incluidos IS NULL OR s.produtos_incluidos = '[]'::jsonb
                                     THEN COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb) ELSE s.produtos_incluidos END,
           updated_at = now()
     WHERE s.id = v_session.id;
  END IF;

  -- Recalcula o valor pago a partir das transações já existentes da sessão
  PERFORM public.recompute_session_paid(NEW.session_id);

  RETURN NEW;
END;
$$;

-- 3. Limpeza de dados: sessões que haviam recebido 'agendada' ou 'agendado' voltam para NULL (sem status)
UPDATE public.clientes_sessoes
   SET status = NULL,
       updated_at = now()
 WHERE status IN ('agendada', 'agendado');

-- 4. Reafirmar comentário na coluna documentando regra de produto
COMMENT ON COLUMN public.clientes_sessoes.status IS
  'Etapa de produção do workflow (livre, definida em etapas_trabalho). NULL = intencionalmente sem etapa inicial. Nenhum trigger/função deve aplicar default automático.';
