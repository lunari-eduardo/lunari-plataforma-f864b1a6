-- 1. Reescreve apply_client_credit: tipo='pagamento' + marcador [CREDIT:] + FIFO na origem
CREATE OR REPLACE FUNCTION public.apply_client_credit(
  p_cliente_id uuid,
  p_session_id text,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_session_user uuid;
  v_session_cliente uuid;
  v_session_uuid uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_restante numeric;
  v_saldo numeric;
  v_valor_aplicar numeric;
  v_transacao_id uuid;
  v_ledger_id uuid;
  v_ledger_first_id uuid;
  v_remaining numeric;
  v_lot RECORD;
  v_take numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  -- Lock no ledger do cliente
  PERFORM 1 FROM public.cliente_creditos_ledger
   WHERE cliente_id = p_cliente_id
   FOR UPDATE;

  -- Saldo atual
  SELECT COALESCE(SUM(valor), 0) INTO v_saldo
  FROM public.cliente_creditos_ledger
  WHERE cliente_id = p_cliente_id;

  IF v_saldo < p_valor THEN
    RAISE EXCEPTION 'Saldo insuficiente (disponível: %, solicitado: %)', v_saldo, p_valor;
  END IF;

  -- Valida sessão de destino
  SELECT id, user_id, cliente_id, COALESCE(valor_total, 0), COALESCE(valor_pago, 0)
    INTO v_session_uuid, v_session_user, v_session_cliente, v_valor_total, v_valor_pago
  FROM public.clientes_sessoes
  WHERE session_id = p_session_id
  FOR UPDATE;

  IF v_session_uuid IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  IF v_session_user <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão para esta sessão';
  END IF;

  IF v_session_cliente <> p_cliente_id THEN
    RAISE EXCEPTION 'Cliente não corresponde à sessão';
  END IF;

  v_restante := GREATEST(v_valor_total - v_valor_pago, 0);
  IF v_restante <= 0 THEN
    RAISE EXCEPTION 'Sessão já está quitada';
  END IF;

  v_valor_aplicar := LEAST(p_valor, v_restante);

  -- 1) Cria transação como PAGAMENTO REAL (não mais ajuste)
  INSERT INTO public.clientes_transacoes (
    cliente_id, session_id, user_id, valor, data_transacao, tipo, descricao, updated_by
  ) VALUES (
    p_cliente_id, p_session_id, v_user_id, v_valor_aplicar, CURRENT_DATE,
    'pagamento',
    'Crédito do cliente aplicado',
    v_user_id
  )
  RETURNING id INTO v_transacao_id;

  -- 2) FIFO nos lotes de crédito: consome dos mais antigos primeiro,
  --    marcando session_id_origem em cada linha de consumo.
  v_remaining := v_valor_aplicar;
  FOR v_lot IN
    SELECT
      session_id_origem,
      SUM(valor) AS saldo_lote,
      MIN(created_at) AS ordem
    FROM public.cliente_creditos_ledger
    WHERE cliente_id = p_cliente_id
      AND session_id_origem IS NOT NULL
    GROUP BY session_id_origem
    HAVING SUM(valor) > 0
    ORDER BY MIN(created_at) ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_lot.saldo_lote);

    INSERT INTO public.cliente_creditos_ledger (
      user_id, cliente_id, data, valor, origem,
      session_id_origem, session_id_consumo, transacao_id, descricao, created_by
    ) VALUES (
      v_user_id, p_cliente_id, CURRENT_DATE, -v_take, 'consumo_desconto',
      v_lot.session_id_origem, p_session_id, v_transacao_id,
      'Consumo em sessão ' || p_session_id, v_user_id
    )
    RETURNING id INTO v_ledger_id;

    IF v_ledger_first_id IS NULL THEN
      v_ledger_first_id := v_ledger_id;
    END IF;

    v_remaining := v_remaining - v_take;
  END LOOP;

  -- 3) Se ainda restou (crédito sem session_id_origem — ex.: ajuste manual sem sessão),
  --    lança consumo sem session_id_origem
  IF v_remaining > 0 THEN
    INSERT INTO public.cliente_creditos_ledger (
      user_id, cliente_id, data, valor, origem,
      session_id_consumo, transacao_id, descricao, created_by
    ) VALUES (
      v_user_id, p_cliente_id, CURRENT_DATE, -v_remaining, 'consumo_desconto',
      p_session_id, v_transacao_id,
      'Consumo em sessão ' || p_session_id, v_user_id
    )
    RETURNING id INTO v_ledger_id;

    IF v_ledger_first_id IS NULL THEN
      v_ledger_first_id := v_ledger_id;
    END IF;
  END IF;

  -- 4) Atualiza descrição da transação com o marcador [CREDIT:<ledger_id>]
  UPDATE public.clientes_transacoes
     SET descricao = 'Crédito do cliente aplicado [CREDIT:' || v_ledger_first_id::text || ']'
   WHERE id = v_transacao_id;

  -- 5) Atualiza denormalizado credito_aplicado
  UPDATE public.clientes_sessoes
     SET credito_aplicado = COALESCE(credito_aplicado, 0) + v_valor_aplicar
   WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'transacao_id', v_transacao_id,
    'ledger_id', v_ledger_first_id,
    'valor_aplicado', v_valor_aplicar,
    'novo_saldo', v_saldo - v_valor_aplicar
  );
END;
$function$;

-- 2. Backfill: transações antigas de crédito viraram 'ajuste' — passar para 'pagamento'
--    para que o trigger recalc_valor_pago_sessao e o parser do UI as contem corretamente.
UPDATE public.clientes_transacoes t
   SET tipo = 'pagamento',
       descricao = CASE
         WHEN t.descricao ILIKE '%[CREDIT:%' THEN t.descricao
         ELSE COALESCE(t.descricao, 'Crédito do cliente aplicado') || ' [CREDIT:legacy]'
       END,
       updated_at = now()
 WHERE t.tipo = 'ajuste'
   AND t.descricao ILIKE '%Crédito do cliente aplicado%';

-- 3. Backfill: linhas de consumo antigas sem session_id_origem — deriva por FIFO
--    (mais antigo lote positivo do cliente na data do consumo). Idempotente: só
--    preenche quando session_id_origem é NULL.
WITH consumos AS (
  SELECT id, cliente_id, created_at
  FROM public.cliente_creditos_ledger
  WHERE origem = 'consumo_desconto'
    AND session_id_origem IS NULL
), matched AS (
  SELECT
    c.id,
    (
      SELECT l.session_id_origem
      FROM public.cliente_creditos_ledger l
      WHERE l.cliente_id = c.cliente_id
        AND l.session_id_origem IS NOT NULL
        AND l.created_at <= c.created_at
      GROUP BY l.session_id_origem, (SELECT MIN(created_at) FROM public.cliente_creditos_ledger l2 WHERE l2.cliente_id = c.cliente_id AND l2.session_id_origem = l.session_id_origem)
      HAVING SUM(l.valor) > 0
      ORDER BY MIN(l.created_at) ASC
      LIMIT 1
    ) AS session_id_origem
  FROM consumos c
)
UPDATE public.cliente_creditos_ledger l
   SET session_id_origem = m.session_id_origem
  FROM matched m
 WHERE l.id = m.id
   AND m.session_id_origem IS NOT NULL;

-- 4. Recalcula valor_pago das sessões afetadas pelo backfill (touch para disparar trigger)
DO $$
DECLARE
  v_session_id text;
BEGIN
  FOR v_session_id IN
    SELECT DISTINCT session_id
    FROM public.clientes_transacoes
    WHERE descricao ILIKE '%[CREDIT:%'
  LOOP
    UPDATE public.clientes_sessoes
       SET updated_at = now()
     WHERE session_id = v_session_id;
  END LOOP;
END $$;