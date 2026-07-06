
-- 1) Recompute canônico: valor_pago + credito_aplicado numa única passada
CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clientes_sessoes s
  SET
    valor_pago = COALESCE((
      SELECT SUM(
        CASE
          WHEN t.tipo = 'estorno'   THEN -t.valor
          WHEN t.tipo = 'pagamento' THEN  t.valor
          ELSE 0
        END
      )
      FROM public.clientes_transacoes t
      WHERE t.session_id = p_session_id
        AND t.tipo IN ('pagamento','estorno')
    ), 0),
    credito_aplicado = COALESCE((
      SELECT SUM(-l.valor)
      FROM public.cliente_creditos_ledger l
      WHERE l.session_id_consumo = p_session_id
        AND l.origem IN ('consumo_desconto','reversao_consumo')
    ), 0),
    updated_at = now()
  WHERE s.session_id = p_session_id;
END;
$function$;

-- 2) Trigger no ledger recompila as duas sessões afetadas (origem e consumo)
CREATE OR REPLACE FUNCTION public.trg_recompute_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.session_id_consumo, OLD.session_id_consumo) IS NOT NULL THEN
    PERFORM public.recompute_session_paid(COALESCE(NEW.session_id_consumo, OLD.session_id_consumo));
  END IF;
  IF COALESCE(NEW.session_id_origem, OLD.session_id_origem) IS NOT NULL THEN
    PERFORM public.recompute_session_paid(COALESCE(NEW.session_id_origem, OLD.session_id_origem));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Substitui o trigger antigo que só sincronizava credito_aplicado
DROP TRIGGER IF EXISTS trg_sync_credito_aplicado ON public.cliente_creditos_ledger;
DROP TRIGGER IF EXISTS trg_ledger_recompute ON public.cliente_creditos_ledger;
CREATE TRIGGER trg_ledger_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.cliente_creditos_ledger
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_from_ledger();

-- 3) Backfill: recompila todas as sessões com transações ou consumo
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT session_id AS sid
    FROM public.clientes_transacoes
    WHERE session_id IS NOT NULL AND tipo IN ('pagamento','estorno')
    UNION
    SELECT DISTINCT session_id_consumo AS sid
    FROM public.cliente_creditos_ledger
    WHERE session_id_consumo IS NOT NULL
  LOOP
    PERFORM public.recompute_session_paid(r.sid);
  END LOOP;
END $$;

-- 4) Guard-rail: proteger contra valor_pago negativo em qualquer futuro bug
ALTER TABLE public.clientes_sessoes
  DROP CONSTRAINT IF EXISTS clientes_sessoes_valor_pago_nao_negativo;
ALTER TABLE public.clientes_sessoes
  ADD CONSTRAINT clientes_sessoes_valor_pago_nao_negativo
  CHECK (valor_pago >= 0) NOT VALID;

-- 5) Endurece apply_client_credit contra double-click / duplicação de linha:
--    se já existe uma transação [CREDIT:] com mesmo cliente/sessão/valor criada nos
--    últimos 5 segundos, retorna a existente ao invés de criar uma nova.
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
  v_existing_tx uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  -- Idempotência anti-double-click: transação de crédito idêntica nos últimos 5s
  SELECT id INTO v_existing_tx
  FROM public.clientes_transacoes
  WHERE cliente_id = p_cliente_id
    AND session_id = p_session_id
    AND valor = p_valor
    AND tipo = 'pagamento'
    AND descricao ILIKE '%[CREDIT:%'
    AND created_at > now() - interval '5 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_tx IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'transacao_id', v_existing_tx,
      'ledger_id', NULL,
      'valor_aplicado', p_valor,
      'novo_saldo', (SELECT COALESCE(SUM(valor),0) FROM public.cliente_creditos_ledger WHERE cliente_id = p_cliente_id),
      'idempotent', true
    );
  END IF;

  -- Lock no ledger do cliente
  PERFORM 1 FROM public.cliente_creditos_ledger
   WHERE cliente_id = p_cliente_id
   FOR UPDATE;

  SELECT COALESCE(SUM(valor), 0) INTO v_saldo
  FROM public.cliente_creditos_ledger
  WHERE cliente_id = p_cliente_id;

  IF v_saldo < p_valor THEN
    RAISE EXCEPTION 'Saldo insuficiente (disponível: %, solicitado: %)', v_saldo, p_valor;
  END IF;

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

  INSERT INTO public.clientes_transacoes (
    cliente_id, session_id, user_id, valor, data_transacao, tipo, descricao, updated_by
  ) VALUES (
    p_cliente_id, p_session_id, v_user_id, v_valor_aplicar, CURRENT_DATE,
    'pagamento',
    'Crédito do cliente aplicado',
    v_user_id
  )
  RETURNING id INTO v_transacao_id;

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

  UPDATE public.clientes_transacoes
     SET descricao = 'Crédito do cliente aplicado [CREDIT:' || v_ledger_first_id::text || ']'
   WHERE id = v_transacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'transacao_id', v_transacao_id,
    'ledger_id', v_ledger_first_id,
    'valor_aplicado', v_valor_aplicar,
    'novo_saldo', v_saldo - v_valor_aplicar
  );
END;
$function$;
