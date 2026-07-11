
-- ============================================================
-- FIX: delete_workflow_session_cascade — resolver appointment
-- via fallback (appointments.session_id) e desvincular no preserve
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
  v_unlinked_appointment integer := 0;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_action NOT IN ('preserve', 'refund', 'remove') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be preserve, refund or remove', p_action;
  END IF;

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

  -- Fallback: resolver appointment por appointments.session_id quando
  -- clientes_sessoes.appointment_id estiver NULL (sessões antigas).
  IF v_appointment_id IS NULL AND v_session_text_id IS NOT NULL THEN
    SELECT id INTO v_appointment_id
    FROM appointments
    WHERE session_id = v_session_text_id AND user_id = v_session_user_id
    LIMIT 1;
  END IF;

  -- ============================================================
  -- AÇÃO 1: PRESERVE — arquiva sessão e DESVINCULA appointment
  -- (agendamento permanece na agenda como compromisso avulso)
  -- ============================================================
  IF p_action = 'preserve' THEN
    UPDATE clientes_sessoes
    SET status = 'historico', updated_at = now(), updated_by = v_user_id, appointment_id = NULL
    WHERE id = p_session_pk;
    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    IF v_appointment_id IS NOT NULL THEN
      UPDATE appointments
      SET session_id = NULL, updated_at = now()
      WHERE id = v_appointment_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_unlinked_appointment = ROW_COUNT;
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'preserve',
      'session_pk', p_session_pk,
      'soft_deleted', v_deleted_session > 0,
      'unlinked_appointment', v_unlinked_appointment
    );
    RETURN v_result;
  END IF;

  -- ============================================================
  -- AÇÃO 2: REFUND — estornos + exclui sessão + appointment
  -- ============================================================
  IF p_action = 'refund' THEN
    IF v_session_text_id IS NOT NULL THEN
      WITH inserted_estornos AS (
        INSERT INTO clientes_transacoes
          (user_id, cliente_id, session_id, tipo, valor, data_transacao, descricao, updated_by)
        SELECT
          t.user_id, t.cliente_id, t.session_id, 'estorno', t.valor, CURRENT_DATE,
          'Estorno: ' || COALESCE(t.descricao, 'Pagamento') || ' (sessão excluída)', v_user_id
        FROM clientes_transacoes t
        WHERE t.session_id = v_session_text_id AND t.user_id = v_user_id AND t.tipo = 'pagamento'
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_estornos_criados FROM inserted_estornos;

      UPDATE clientes_transacoes
      SET session_id = NULL, updated_at = now(), updated_by = v_user_id
      WHERE session_id = v_session_text_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_unlinked_transactions = ROW_COUNT;
    END IF;

    DELETE FROM clientes_sessoes WHERE id = p_session_pk AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    IF v_appointment_id IS NOT NULL THEN
      DELETE FROM appointments WHERE id = v_appointment_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_appointment = ROW_COUNT;
    END IF;

    v_result := jsonb_build_object(
      'success', true, 'action', 'refund', 'session_pk', p_session_pk,
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

      DELETE FROM clientes_transacoes
      WHERE session_id = v_session_text_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;
    END IF;

    DELETE FROM clientes_sessoes WHERE id = p_session_pk AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_session = ROW_COUNT;

    IF v_appointment_id IS NOT NULL THEN
      DELETE FROM appointments WHERE id = v_appointment_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted_appointment = ROW_COUNT;
    END IF;

    v_result := jsonb_build_object(
      'success', true, 'action', 'remove', 'session_pk', p_session_pk,
      'deleted_transactions', v_deleted_transactions,
      'deleted_cobrancas', v_deleted_cobrancas,
      'unlinked_cobrancas', v_unlinked_cobrancas,
      'deleted_session', v_deleted_session,
      'deleted_appointment', v_deleted_appointment
    );
    RETURN v_result;
  END IF;

  RAISE EXCEPTION 'Unhandled action path';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_workflow_session_cascade(uuid, text) TO authenticated;

-- ============================================================
-- DATA-FIX (one-shot): reidratar vínculos e limpar órfãos
-- ============================================================

-- Reidrata clientes_sessoes.appointment_id onde estava NULL mas existe
-- appointment correspondente (mesmo user_id + session_id textual).
UPDATE clientes_sessoes s
SET appointment_id = a.id
FROM appointments a
WHERE s.appointment_id IS NULL
  AND a.session_id IS NOT NULL
  AND a.session_id = s.session_id
  AND a.user_id = s.user_id;

-- Remove appointments órfãos (session_id textual aponta para sessão que
-- já não existe — resíduos das exclusões antigas que deixaram o agendamento).
DELETE FROM appointments a
WHERE a.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_sessoes s WHERE s.session_id = a.session_id
  );
