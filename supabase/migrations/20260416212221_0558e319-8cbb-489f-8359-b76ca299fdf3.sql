-- RECONCILIAÇÃO: corrige cobranças órfãs (session_id NULL ou apontando para 'agenda-*' sem clientes_sessoes)
-- Cria clientes_sessoes faltantes a partir do appointment_id resolvido pela cobrança/transação
-- e re-vincula cobrança + transação para disparar recompute e auto-confirm.

DO $$
DECLARE
  rec RECORD;
  v_appointment RECORD;
  v_session_id TEXT;
BEGIN
  -- Itera todas as cobranças PAGAS cujo session_id é NULL OU aponta para 'agenda-*'
  -- mas que NÃO têm clientes_sessoes correspondente
  FOR rec IN
    SELECT c.id AS cobranca_id, c.user_id, c.cliente_id, c.session_id, c.descricao
    FROM public.cobrancas c
    WHERE c.status = 'pago'
      AND (
        c.session_id IS NULL
        OR (
          c.session_id LIKE 'agenda-%'
          AND NOT EXISTS (
            SELECT 1 FROM public.clientes_sessoes s
            WHERE s.session_id = c.session_id AND s.user_id = c.user_id
          )
        )
      )
  LOOP
    -- Tenta achar o appointment correspondente (mesmo user, mesmo cliente, status 'a confirmar' ou pelo session_id)
    SELECT a.* INTO v_appointment
    FROM public.appointments a
    WHERE a.user_id = rec.user_id
      AND (
        (rec.session_id IS NOT NULL AND a.session_id = rec.session_id)
        OR (rec.session_id IS NULL AND a.cliente_id = rec.cliente_id AND a.status = 'a confirmar')
      )
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_appointment.id IS NULL THEN
      RAISE NOTICE 'Cobrança % sem appointment correspondente, pulando.', rec.cobranca_id;
      CONTINUE;
    END IF;

    v_session_id := v_appointment.session_id;

    -- Cria clientes_sessoes se não existir
    INSERT INTO public.clientes_sessoes (
      user_id, cliente_id, session_id, appointment_id,
      data_sessao, hora_sessao, categoria, status,
      valor_total, valor_pago, tipo_registro
    )
    SELECT
      v_appointment.user_id,
      COALESCE(v_appointment.cliente_id, rec.cliente_id),
      v_appointment.session_id,
      v_appointment.id,
      v_appointment.date,
      v_appointment.time,
      COALESCE(v_appointment.type, 'sessao'),
      'agendado',
      0,
      0,
      'workflow'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.clientes_sessoes s WHERE s.appointment_id = v_appointment.id
    );

    -- Re-vincular cobrança e transação ao session_id correto
    UPDATE public.cobrancas
       SET session_id = v_session_id
     WHERE id = rec.cobranca_id;

    UPDATE public.clientes_transacoes
       SET session_id = v_session_id
     WHERE cobranca_id = rec.cobranca_id;

    -- Forçar recompute do valor_pago via touch (trigger dispara auto-confirm)
    UPDATE public.clientes_sessoes
       SET updated_at = now()
     WHERE session_id = v_session_id AND user_id = rec.user_id;

    RAISE NOTICE 'Reconciliada cobrança % → session %', rec.cobranca_id, v_session_id;
  END LOOP;
END $$;