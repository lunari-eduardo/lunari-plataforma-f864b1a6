
-- 1) Correção Eduarda: repor +25 no ledger com trilha
INSERT INTO public.cliente_creditos_ledger (
  user_id, cliente_id, data, valor, origem,
  session_id_origem, descricao, created_by
)
SELECT
  c.user_id,
  c.id,
  CURRENT_DATE,
  25.00,
  'ajuste_manual',
  'workflow-1768420319506-go8nz7fkl0s',
  'Correção — reversão indevida do overpay da sessão de 15/jan',
  c.user_id
FROM public.clientes c
WHERE c.id = 'df9bab26-5d5c-44d9-9f97-c28542cc7fd5';

-- 2) Hardening do trigger: soma TODOS os lançamentos da sessão para idempotência
CREATE OR REPLACE FUNCTION public.trg_auto_credit_overpay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id text;
  v_session_uuid uuid;
  v_cliente_id uuid;
  v_user_id uuid;
  v_valor_total numeric;
  v_valor_pago_externo numeric;
  v_credito_atual numeric;
  v_delta_desejado numeric;
  v_ajuste numeric;
BEGIN
  IF TG_TABLE_NAME = 'clientes_transacoes' THEN
    v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  ELSIF TG_TABLE_NAME = 'clientes_sessoes' THEN
    v_session_id := NEW.session_id;
  END IF;

  IF v_session_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, cliente_id, user_id, COALESCE(valor_total, 0)
    INTO v_session_uuid, v_cliente_id, v_user_id, v_valor_total
  FROM public.clientes_sessoes
  WHERE session_id = v_session_id;

  IF v_session_uuid IS NULL OR v_cliente_id IS NULL OR v_valor_total <= 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_valor_pago_externo := public.compute_valor_pago_externo(v_session_id);
  v_delta_desejado := GREATEST(v_valor_pago_externo - v_valor_total, 0);

  -- Soma TODOS os lançamentos vinculados a esta sessão (origem + reversões manuais)
  -- Isso torna o trigger idempotente mesmo após revoke_client_credit
  SELECT COALESCE(SUM(valor), 0) INTO v_credito_atual
  FROM public.cliente_creditos_ledger
  WHERE session_id_origem = v_session_id
    AND origem IN ('overpay', 'reducao_escopo', 'reversao_grant');

  v_ajuste := v_delta_desejado - v_credito_atual;

  IF v_ajuste = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_ajuste > 0 THEN
    INSERT INTO public.cliente_creditos_ledger (
      user_id, cliente_id, data, valor, origem,
      session_id_origem, descricao, created_by
    ) VALUES (
      v_user_id, v_cliente_id, CURRENT_DATE, v_ajuste,
      CASE WHEN TG_TABLE_NAME = 'clientes_sessoes' THEN 'reducao_escopo' ELSE 'overpay' END,
      v_session_id,
      'Crédito automático (' || CASE WHEN TG_TABLE_NAME = 'clientes_sessoes' THEN 'redução de escopo' ELSE 'pagamento a maior' END || ')',
      v_user_id
    );
  ELSE
    -- Só reduz se ainda houver crédito da sessão para reverter (clamp)
    IF v_credito_atual > 0 THEN
      INSERT INTO public.cliente_creditos_ledger (
        user_id, cliente_id, data, valor, origem,
        session_id_origem, descricao, created_by
      ) VALUES (
        v_user_id, v_cliente_id, CURRENT_DATE, GREATEST(v_ajuste, -v_credito_atual),
        'reversao_grant',
        v_session_id,
        'Ajuste automático de crédito (recomputo)',
        v_user_id
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
