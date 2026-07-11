-- 1) compute_valor_pago_externo: estorno deve subtrair
CREATE OR REPLACE FUNCTION public.compute_valor_pago_externo(p_session_id text)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN t.tipo = 'estorno' THEN -ABS(t.valor)
      WHEN t.tipo IN ('pagamento','ajuste') THEN t.valor
      ELSE 0
    END
  ), 0)
  FROM public.clientes_transacoes t
  WHERE t.session_id = p_session_id
    AND t.tipo IN ('pagamento','ajuste','estorno')
    AND NOT EXISTS (
      SELECT 1 FROM public.cliente_creditos_ledger l
      WHERE l.transacao_id = t.id AND l.origem = 'consumo_desconto'
    );
$$;

COMMENT ON FUNCTION public.compute_valor_pago_externo(text) IS
'Soma líquida de pagamentos externos. Estornos são sempre subtraídos (valor gravado como magnitude positiva).';

-- 2) trg_auto_credit_overpay: usa RPC (RPC-aware) + blindagem contra extras pendentes
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
  v_extras_pendentes_galeria boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'clientes_transacoes' THEN
    v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  ELSIF TG_TABLE_NAME = 'clientes_sessoes' THEN
    v_session_id := NEW.session_id;
  END IF;

  IF v_session_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT id, cliente_id, user_id
    INTO v_session_uuid, v_cliente_id, v_user_id
  FROM public.clientes_sessoes
  WHERE session_id = v_session_id;

  IF v_session_uuid IS NULL OR v_cliente_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  BEGIN
    SELECT COALESCE(f.valor_total, 0)
      INTO v_valor_total
    FROM public.workflow_session_financials(v_session_uuid) f
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT COALESCE(valor_total, 0) INTO v_valor_total
    FROM public.clientes_sessoes WHERE id = v_session_uuid;
  END;

  IF v_valor_total IS NULL OR v_valor_total <= 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.galerias g
    WHERE g.session_id = v_session_id
      AND g.status = 'selecao_completa'
      AND COALESCE(g.fotos_selecionadas, 0) - COALESCE(g.fotos_incluidas, 0)
          > COALESCE(g.total_fotos_extras_vendidas, 0)
  ) INTO v_extras_pendentes_galeria;

  v_valor_pago_externo := public.compute_valor_pago_externo(v_session_id);
  v_delta_desejado := GREATEST(v_valor_pago_externo - v_valor_total, 0);

  SELECT COALESCE(SUM(valor), 0) INTO v_credito_atual
  FROM public.cliente_creditos_ledger
  WHERE session_id_origem = v_session_id
    AND origem IN ('overpay','reducao_escopo','reversao_grant');

  v_ajuste := v_delta_desejado - v_credito_atual;

  IF v_ajuste = 0 THEN RETURN COALESCE(NEW, OLD); END IF;

  IF v_ajuste > 0 THEN
    IF v_extras_pendentes_galeria THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
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

COMMENT ON FUNCTION public.trg_auto_credit_overpay() IS
'Concilia créditos automáticos. Lê valor_total via RPC workflow_session_financials e não gera crédito quando há extras selecionados pendentes de cobrança.';

-- 3) Constraint: estorno sempre com valor >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_estorno_valor_positivo'
      AND conrelid = 'public.clientes_transacoes'::regclass
  ) THEN
    ALTER TABLE public.clientes_transacoes
      ADD CONSTRAINT chk_estorno_valor_positivo
      CHECK (tipo <> 'estorno' OR valor >= 0);
  END IF;
END $$;

-- 4) View de auditoria
CREATE OR REPLACE VIEW public.v_credit_overpay_audit AS
SELECT
  l.id AS ledger_id, l.user_id, l.cliente_id,
  l.session_id_origem, l.origem, l.valor, l.data, l.descricao,
  s.id AS session_uuid,
  f.valor_total, f.valor_pago, f.valor_pendente, f.credito_liquido
FROM public.cliente_creditos_ledger l
LEFT JOIN public.clientes_sessoes s ON s.session_id = l.session_id_origem
LEFT JOIN LATERAL public.workflow_session_financials(s.id) f ON true
WHERE l.origem IN ('overpay','reducao_escopo')
  AND COALESCE(f.valor_pendente, 0) > 0.01;

GRANT SELECT ON public.v_credit_overpay_audit TO authenticated;
GRANT ALL ON public.v_credit_overpay_audit TO service_role;

-- 5) Hotfix retroativo: recomputa a sessão "Cliente Novo"
UPDATE public.clientes_transacoes
SET updated_at = now()
WHERE id IN (
  SELECT t.id
  FROM public.clientes_transacoes t
  JOIN public.clientes_sessoes s ON s.session_id = t.session_id
  WHERE s.id = '672ec35c-1342-4358-9bf7-e05536101f10'
    AND t.tipo = 'pagamento'
  ORDER BY t.created_at DESC
  LIMIT 1
);
