-- =====================================================
-- FASE 3: TRANSAÇÕES ATÔMICAS VIA RPC FUNCTIONS
-- =====================================================

-- RPC 1: Exclusão em cascata de appointment
-- Substitui lógica de 5 queries separadas por uma única transação atômica
CREATE OR REPLACE FUNCTION public.delete_appointment_cascade(
  p_appointment_id UUID,
  p_keep_payments BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session_id TEXT;
  v_deleted_transactions INTEGER := 0;
  v_deleted_sessions INTEGER := 0;
  v_deleted_appointments INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Obter user_id do contexto auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 1. Buscar session_id do appointment
  SELECT cs.session_id INTO v_session_id
  FROM appointments a
  LEFT JOIN clientes_sessoes cs ON cs.appointment_id = a.id
  WHERE a.id = p_appointment_id AND a.user_id = v_user_id;
  
  -- 2. Deletar transações (se não for para manter)
  IF v_session_id IS NOT NULL AND NOT p_keep_payments THEN
    DELETE FROM clientes_transacoes
    WHERE session_id = v_session_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;
  END IF;
  
  -- 3. Deletar sessão do workflow
  IF v_session_id IS NOT NULL THEN
    DELETE FROM clientes_sessoes
    WHERE session_id = v_session_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
  END IF;
  
  -- 4. Deletar appointment
  DELETE FROM appointments
  WHERE id = p_appointment_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_appointments = ROW_COUNT;
  
  -- 5. Retornar resultado
  v_result := jsonb_build_object(
    'success', v_deleted_appointments > 0,
    'appointment_id', p_appointment_id,
    'deleted_transactions', v_deleted_transactions,
    'deleted_sessions', v_deleted_sessions,
    'deleted_appointments', v_deleted_appointments
  );
  
  RAISE NOTICE 'Delete cascade result: %', v_result;
  
  RETURN v_result;
END;
$$;


-- RPC 2: Criar sessão a partir de appointment (com lock para evitar duplicatas)
CREATE OR REPLACE FUNCTION public.create_session_from_appointment(
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_appointment RECORD;
  v_existing_session_id UUID;
  v_new_session_id UUID;
  v_session_uuid TEXT;
  v_categoria_nome TEXT;
  v_pacote_nome TEXT;
  v_valor_base NUMERIC;
  v_result JSONB;
BEGIN
  -- Obter user_id do contexto auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Lock na tabela para evitar race conditions
  PERFORM pg_advisory_xact_lock(hashtext('create_session_' || p_appointment_id::text));
  
  -- 1. Verificar se já existe sessão para este appointment
  SELECT id INTO v_existing_session_id
  FROM clientes_sessoes
  WHERE appointment_id = p_appointment_id AND user_id = v_user_id
  LIMIT 1;
  
  IF v_existing_session_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'session_id', v_existing_session_id,
      'reason', 'Session already exists'
    );
  END IF;
  
  -- 2. Buscar dados do appointment
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id AND user_id = v_user_id AND status = 'confirmado';
  
  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Appointment not found or not confirmed'
    );
  END IF;
  
  -- 3. Resolver categoria e pacote
  v_categoria_nome := v_appointment.type;
  v_pacote_nome := NULL;
  v_valor_base := 0;
  
  IF v_appointment.package_id IS NOT NULL AND v_appointment.package_id != '' THEN
    BEGIN
      SELECT c.nome, p.nome, p.valor_base
      INTO v_categoria_nome, v_pacote_nome, v_valor_base
      FROM pacotes p
      JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = v_appointment.package_id::UUID AND p.user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erros de cast
      NULL;
    END;
  END IF;
  
  -- 4. Gerar session_id único
  v_session_uuid := 'session_' || gen_random_uuid()::text;
  
  -- 5. Criar sessão
  INSERT INTO clientes_sessoes (
    user_id,
    cliente_id,
    session_id,
    appointment_id,
    data_sessao,
    hora_sessao,
    categoria,
    pacote,
    descricao,
    status,
    valor_total,
    valor_base_pacote,
    valor_pago,
    produtos_incluidos
  )
  VALUES (
    v_user_id,
    v_appointment.cliente_id,
    v_session_uuid,
    p_appointment_id,
    v_appointment.date,
    v_appointment.time,
    COALESCE(v_categoria_nome, v_appointment.type, 'Sessão'),
    v_pacote_nome,
    v_appointment.description,
    'agendado',
    COALESCE(v_valor_base, 0),
    COALESCE(v_valor_base, 0),
    0,
    '[]'::jsonb
  )
  RETURNING id INTO v_new_session_id;
  
  -- 6. Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'created', true,
    'session_id', v_new_session_id,
    'session_uuid', v_session_uuid,
    'appointment_id', p_appointment_id
  );
  
  RAISE NOTICE 'Session created: %', v_result;
  
  RETURN v_result;
END;
$$;


-- RPC 3: Atualização atômica de pagamentos de sessão
CREATE OR REPLACE FUNCTION public.add_session_payment(
  p_session_id TEXT,
  p_valor NUMERIC,
  p_data_transacao DATE,
  p_descricao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_cliente_id UUID;
  v_transaction_id UUID;
  v_novo_valor_pago NUMERIC;
BEGIN
  -- Obter user_id do contexto auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Lock para evitar race conditions
  PERFORM pg_advisory_xact_lock(hashtext('payment_' || p_session_id));
  
  -- 1. Buscar cliente_id da sessão
  SELECT cliente_id INTO v_cliente_id
  FROM clientes_sessoes
  WHERE session_id = p_session_id AND user_id = v_user_id;
  
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Session not found'
    );
  END IF;
  
  -- 2. Inserir transação
  INSERT INTO clientes_transacoes (
    user_id,
    cliente_id,
    session_id,
    valor,
    tipo,
    data_transacao,
    descricao
  )
  VALUES (
    v_user_id,
    v_cliente_id,
    p_session_id,
    p_valor,
    'pagamento',
    p_data_transacao,
    p_descricao
  )
  RETURNING id INTO v_transaction_id;
  
  -- 3. Recalcular valor_pago (trigger já faz, mas garantir)
  SELECT COALESCE(SUM(valor), 0) INTO v_novo_valor_pago
  FROM clientes_transacoes
  WHERE session_id = p_session_id AND tipo = 'pagamento';
  
  -- 4. Atualizar sessão
  UPDATE clientes_sessoes
  SET valor_pago = v_novo_valor_pago, updated_at = NOW()
  WHERE session_id = p_session_id AND user_id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'novo_valor_pago', v_novo_valor_pago
  );
END;
$$;