-- ============================================================
-- 1) RPC ATÔMICA: delete_workflow_session_cascade
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_workflow_session_cascade(
  p_session_pk uuid,
  p_action text DEFAULT 'remove'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_session_text_id text;
  v_appointment_id uuid;
  v_session_user_id uuid;
  v_deleted_transactions integer := 0;
  v_unlinked_transactions integer := 0;
  v_estornos_criados integer := 0;
  v_deleted_cobrancas integer := 0;
  v_unlinked_cobrancas integer := 0;
  v_deleted_session integer := 0;
  v_deleted_appointment integer := 0;
  v_result jsonb;
BEGIN
  -- Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validação de ação
  IF p_action NOT IN ('preserve', 'refund', 'remove') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be preserve, refund or remove', p_action;
  END IF;

  -- Buscar dados da sessão e validar ownership
  SELECT session_id, appointment_id, user_id
  INTO v_session_text_id, v_appointment_id, v_session_user_id
  FROM clientes_sessoes
  WHERE id = p_session_pk;

  IF v_session_user_id IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_pk;
  END IF;

  IF v_session_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Permission denied: session does not belong to current user';
  END IF;

  -- ============================================================
  -- AÇÃO 1: PRESERVE — soft delete (mantém tudo)
  -- ============================================================
  IF p_action = 'preserve' THEN
    UPDATE clientes_sessoes
    SET status = 'historico', updated_at = now(), updated_by = v_user_id
    WHERE id = p_session_pk;

    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'preserve',
      'session_pk', p_session_pk,
      'soft_deleted', v_deleted_session > 0
    );
    RETURN v_result;
  END IF;

  -- ============================================================
  -- AÇÃO 2: REFUND — gera estornos e exclui sessão+appointment
  -- ============================================================
  IF p_action = 'refund' THEN
    IF v_session_text_id IS NOT NULL THEN
      -- Criar estornos para cada pagamento
      WITH inserted_estornos AS (
        INSERT INTO clientes_transacoes
          (user_id, cliente_id, session_id, tipo, valor, data_transacao, descricao, updated_by)
        SELECT
          t.user_id,
          t.cliente_id,
          t.session_id,
          'estorno',
          t.valor,
          CURRENT_DATE,
          'Estorno: ' || COALESCE(t.descricao, 'Pagamento') || ' (sessão excluída)',
          v_user_id
        FROM clientes_transacoes t
        WHERE t.session_id = v_session_text_id
          AND t.user_id = v_user_id
          AND t.tipo = 'pagamento'
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_estornos_criados FROM inserted_estornos;

      -- Desvincular transações antes de deletar a sessão (preserva auditoria)
      UPDATE clientes_transacoes
      SET session_id = NULL, updated_at = now(), updated_by = v_user_id
      WHERE session_id = v_session_text_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_unlinked_transactions = ROW_COUNT;
    END IF;

    -- Deletar sessão
    DELETE FROM clientes_sessoes WHERE id = p_session_pk AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    -- Deletar appointment vinculado (se houver)
    IF v_appointment_id IS NOT NULL THEN
      DELETE FROM appointments WHERE id = v_appointment_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_appointment = ROW_COUNT;
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'refund',
      'session_pk', p_session_pk,
      'estornos_criados', v_estornos_criados,
      'unlinked_transactions', v_unlinked_transactions,
      'deleted_session', v_deleted_session,
      'deleted_appointment', v_deleted_appointment
    );
    RETURN v_result;
  END IF;

  -- ============================================================
  -- AÇÃO 3: REMOVE — exclui tudo permanentemente
  -- ============================================================
  IF p_action = 'remove' THEN
    IF v_session_text_id IS NOT NULL THEN
      -- 1) Cobranças: separar entre "pode apagar" e "deve apenas desvincular"
      --    Critério: cobrança PAGA com mp_payment_id OU ip_transaction_nsu OU asaas_installment_id => preservar (gateway confirmado)
      --              demais => apagar
      WITH cobrancas_da_sessao AS (
        SELECT id, status, mp_payment_id, ip_transaction_nsu, asaas_installment_id
        FROM cobrancas
        WHERE session_id = v_session_text_id AND user_id = v_user_id
      ),
      preservadas AS (
        UPDATE cobrancas
        SET session_id = NULL, updated_at = now()
        WHERE id IN (
          SELECT id FROM cobrancas_da_sessao
          WHERE status = 'pago'
            AND (mp_payment_id IS NOT NULL OR ip_transaction_nsu IS NOT NULL OR asaas_installment_id IS NOT NULL)
        )
        RETURNING 1
      ),
      excluidas AS (
        DELETE FROM cobrancas
        WHERE id IN (
          SELECT id FROM cobrancas_da_sessao
          WHERE NOT (status = 'pago'
            AND (mp_payment_id IS NOT NULL OR ip_transaction_nsu IS NOT NULL OR asaas_installment_id IS NOT NULL))
        )
        RETURNING 1
      )
      SELECT
        (SELECT COUNT(*) FROM preservadas),
        (SELECT COUNT(*) FROM excluidas)
      INTO v_unlinked_cobrancas, v_deleted_cobrancas;

      -- 2) Transações: apagar todas as vinculadas à sessão
      DELETE FROM clientes_transacoes
      WHERE session_id = v_session_text_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;
    END IF;

    -- 3) Deletar sessão
    DELETE FROM clientes_sessoes WHERE id = p_session_pk AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    -- 4) Deletar appointment vinculado
    IF v_appointment_id IS NOT NULL THEN
      DELETE FROM appointments WHERE id = v_appointment_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_appointment = ROW_COUNT;
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'remove',
      'session_pk', p_session_pk,
      'deleted_transactions', v_deleted_transactions,
      'deleted_cobrancas', v_deleted_cobrancas,
      'unlinked_cobrancas', v_unlinked_cobrancas,
      'deleted_session', v_deleted_session,
      'deleted_appointment', v_deleted_appointment
    );
    RETURN v_result;
  END IF;

  -- Não deve chegar aqui
  RAISE EXCEPTION 'Unhandled action path';
END;
$function$;

-- Permitir que usuários autenticados chamem
GRANT EXECUTE ON FUNCTION public.delete_workflow_session_cascade(uuid, text) TO authenticated;

-- ============================================================
-- 2) VIEW: transações órfãs (somente leitura, escopo do usuário)
-- ============================================================
CREATE OR REPLACE VIEW public.vw_transacoes_orfas
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.user_id,
  t.cliente_id,
  c.nome AS cliente_nome,
  t.tipo,
  t.valor,
  t.descricao,
  t.data_transacao,
  t.cobranca_id,
  t.created_at
FROM clientes_transacoes t
LEFT JOIN clientes c ON c.id = t.cliente_id
WHERE t.session_id IS NULL;

GRANT SELECT ON public.vw_transacoes_orfas TO authenticated;

-- ============================================================
-- 3) BACKFILL PONTUAL: limpar sessão do Eduardo Valmor (68f97f40-…)
--    A tentativa de exclusão de hoje deixou tudo intacto.
--    Vamos fazer a limpeza correta usando lógica equivalente à da RPC.
-- ============================================================
DO $$
DECLARE
  v_session_pk uuid := '68f97f40-8888-4f76-a054-c5f993e44b8b';
  v_session_text text;
  v_appointment_id uuid;
  v_user_id uuid;
BEGIN
  SELECT session_id, appointment_id, user_id
  INTO v_session_text, v_appointment_id, v_user_id
  FROM clientes_sessoes
  WHERE id = v_session_pk;

  IF v_user_id IS NOT NULL THEN
    -- Apagar transações ainda vinculadas
    IF v_session_text IS NOT NULL THEN
      DELETE FROM clientes_transacoes
      WHERE session_id = v_session_text AND user_id = v_user_id;

      -- Cobranças: aplicar mesma regra (preservar gateway pago, apagar resto)
      UPDATE cobrancas
      SET session_id = NULL, updated_at = now()
      WHERE session_id = v_session_text AND user_id = v_user_id
        AND status = 'pago'
        AND (mp_payment_id IS NOT NULL OR ip_transaction_nsu IS NOT NULL OR asaas_installment_id IS NOT NULL);

      DELETE FROM cobrancas
      WHERE session_id = v_session_text AND user_id = v_user_id
        AND NOT (status = 'pago'
          AND (mp_payment_id IS NOT NULL OR ip_transaction_nsu IS NOT NULL OR asaas_installment_id IS NOT NULL));
    END IF;

    -- Apagar sessão
    DELETE FROM clientes_sessoes WHERE id = v_session_pk;

    -- Apagar appointment vinculado
    IF v_appointment_id IS NOT NULL THEN
      DELETE FROM appointments WHERE id = v_appointment_id AND user_id = v_user_id;
    END IF;

    RAISE NOTICE 'Cleanup pontual da sessão Eduardo Valmor (%) executado', v_session_pk;
  ELSE
    RAISE NOTICE 'Sessão Eduardo Valmor (%) já não existia', v_session_pk;
  END IF;
END $$;

-- Apagar também o pagamento órfão de R$ 112,00 do Eduardo (criado HOJE pela tentativa anterior)
-- session_id = NULL, descrição contém "quick-1777137114832-sp6pi19ff"
DELETE FROM clientes_transacoes
WHERE session_id IS NULL
  AND descricao LIKE '%quick-1777137114832-sp6pi19ff%';