
-- =========================================================================
-- 1) Nova versão do finance_get_opening_balance
--    Rollover = Σ receita paga do workflow (clientes_sessoes.valor_pago)
--             + Σ receitas não operacionais pagas (fin_transactions)
--             − Σ despesas + investimentos pagos (fin_transactions)
--    Cascata: override manual do ano → rollover dos últimos 3 anos → zero.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_get_opening_balance(_ano int)
RETURNS TABLE (valor numeric, origem text, ano_base int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _override numeric;
  _rollover numeric := 0;
  _prev int := _ano - 1;
  _guard int := 0;
  _partial numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 1) override manual do próprio ano
  SELECT ob.valor INTO _override
    FROM public.fin_opening_balances ob
   WHERE ob.user_id = _uid AND ob.ano = _ano AND ob.origem = 'manual'
   LIMIT 1;
  IF _override IS NOT NULL THEN
    RETURN QUERY SELECT _override, 'manual'::text, _ano;
    RETURN;
  END IF;

  -- 2) rollover: soma até 3 anos anteriores
  WHILE _guard < 3 LOOP
    -- 2a) Receita operacional real do workflow (sessões pagas)
    SELECT COALESCE(SUM(COALESCE(cs.valor_pago, 0)), 0)
      INTO _partial
      FROM public.clientes_sessoes cs
     WHERE cs.user_id = _uid
       AND COALESCE(cs.tipo_registro, 'workflow') = 'workflow'
       AND (cs.status IS NULL OR cs.status <> 'historico')
       AND cs.data_sessao >= make_date(_prev, 1, 1)
       AND cs.data_sessao <= make_date(_prev, 12, 31);
    _rollover := _rollover + _partial;

    -- 2b) Receitas não operacionais + despesas em fin_transactions
    SELECT COALESCE(SUM(CASE
        WHEN fi.grupo_principal = 'Receita Não Operacional' THEN ft.valor
        WHEN fi.grupo_principal = 'Receita Operacional'    THEN ft.valor
        WHEN fi.grupo_principal IN ('Despesa Fixa','Despesa Variável','Investimento') THEN -ft.valor
        ELSE 0 END), 0)
      INTO _partial
      FROM public.fin_transactions ft
      JOIN public.fin_items_master fi ON fi.id = ft.item_id
     WHERE ft.user_id = _uid
       AND ft.status = 'Pago'
       AND date_part('year', ft.data_vencimento) = _prev;
    _rollover := _rollover + _partial;

    -- Se o ano anterior tem override manual, ele é a âncora do cálculo
    SELECT ob.valor INTO _override
      FROM public.fin_opening_balances ob
     WHERE ob.user_id = _uid AND ob.ano = _prev AND ob.origem = 'manual'
     LIMIT 1;
    IF _override IS NOT NULL THEN
      RETURN QUERY SELECT (_override + _rollover), 'auto_rollover'::text, _prev;
      RETURN;
    END IF;

    _prev := _prev - 1;
    _guard := _guard + 1;
  END LOOP;

  RETURN QUERY SELECT _rollover,
    CASE WHEN _rollover = 0 THEN 'zero' ELSE 'auto_rollover' END::text,
    (_ano - 1);
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_get_opening_balance(int) TO authenticated;

-- =========================================================================
-- 2) finance_get_saldo_ate(_data)
--    Retorna o saldo acumulado do usuário até (inclusive) uma data.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_get_saldo_ate(_data date)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ano int := date_part('year', _data)::int;
  _opening numeric := 0;
  _workflow numeric := 0;
  _fin numeric := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT valor INTO _opening
    FROM public.finance_get_opening_balance(_ano)
   LIMIT 1;
  _opening := COALESCE(_opening, 0);

  SELECT COALESCE(SUM(COALESCE(cs.valor_pago, 0)), 0)
    INTO _workflow
    FROM public.clientes_sessoes cs
   WHERE cs.user_id = _uid
     AND COALESCE(cs.tipo_registro, 'workflow') = 'workflow'
     AND (cs.status IS NULL OR cs.status <> 'historico')
     AND cs.data_sessao >= make_date(_ano, 1, 1)
     AND cs.data_sessao <= _data;

  SELECT COALESCE(SUM(CASE
      WHEN fi.grupo_principal IN ('Receita Não Operacional','Receita Operacional') THEN ft.valor
      WHEN fi.grupo_principal IN ('Despesa Fixa','Despesa Variável','Investimento') THEN -ft.valor
      ELSE 0 END), 0)
    INTO _fin
    FROM public.fin_transactions ft
    JOIN public.fin_items_master fi ON fi.id = ft.item_id
   WHERE ft.user_id = _uid
     AND ft.status = 'Pago'
     AND ft.data_vencimento >= make_date(_ano, 1, 1)
     AND ft.data_vencimento <= _data;

  RETURN _opening + _workflow + _fin;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_get_saldo_ate(date) TO authenticated;

-- =========================================================================
-- 3) Garante itens "Ajuste de saldo (entrada/saída)" (is_system-like via is_default)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_ensure_ajuste_items()
RETURNS TABLE (item_entrada uuid, item_saida uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _in  uuid;
  _out uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO _in
    FROM public.fin_items_master
   WHERE user_id = _uid
     AND nome = 'Ajuste de saldo (entrada)'
     AND grupo_principal = 'Receita Não Operacional'
   LIMIT 1;
  IF _in IS NULL THEN
    INSERT INTO public.fin_items_master (user_id, nome, grupo_principal, ativo, is_default)
    VALUES (_uid, 'Ajuste de saldo (entrada)', 'Receita Não Operacional', true, true)
    RETURNING id INTO _in;
  END IF;

  SELECT id INTO _out
    FROM public.fin_items_master
   WHERE user_id = _uid
     AND nome = 'Ajuste de saldo (saída)'
     AND grupo_principal = 'Despesa Variável'
   LIMIT 1;
  IF _out IS NULL THEN
    INSERT INTO public.fin_items_master (user_id, nome, grupo_principal, ativo, is_default)
    VALUES (_uid, 'Ajuste de saldo (saída)', 'Despesa Variável', true, true)
    RETURNING id INTO _out;
  END IF;

  RETURN QUERY SELECT _in, _out;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_ensure_ajuste_items() TO authenticated;

-- =========================================================================
-- 4) finance_apply_saldo_ajuste
--    Cria transação real para reconciliar saldo em conta.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_apply_saldo_ajuste(
  _data date,
  _saldo_desejado numeric,
  _observacoes text DEFAULT NULL
)
RETURNS TABLE (acao text, valor_delta numeric, transaction_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _atual numeric;
  _delta numeric;
  _item_in uuid;
  _item_out uuid;
  _new_id uuid;
  _obs text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _data IS NULL THEN RAISE EXCEPTION 'data obrigatória'; END IF;
  IF _saldo_desejado IS NULL THEN RAISE EXCEPTION 'saldo desejado obrigatório'; END IF;

  _atual := public.finance_get_saldo_ate(_data);
  _delta := round((_saldo_desejado - _atual)::numeric, 2);

  IF abs(_delta) < 0.01 THEN
    RETURN QUERY SELECT 'noop'::text, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  SELECT item_entrada, item_saida INTO _item_in, _item_out
    FROM public.finance_ensure_ajuste_items();

  _obs := '[Ajuste de saldo] ' || COALESCE(NULLIF(_observacoes, ''), 'Conciliação com saldo em conta');

  IF _delta > 0 THEN
    INSERT INTO public.fin_transactions (user_id, item_id, valor, data_vencimento, status, observacoes)
    VALUES (_uid, _item_in, _delta, _data, 'Pago', _obs)
    RETURNING id INTO _new_id;
    RETURN QUERY SELECT 'entrada'::text, _delta, _new_id;
  ELSE
    INSERT INTO public.fin_transactions (user_id, item_id, valor, data_vencimento, status, observacoes)
    VALUES (_uid, _item_out, abs(_delta), _data, 'Pago', _obs)
    RETURNING id INTO _new_id;
    RETURN QUERY SELECT 'saida'::text, _delta, _new_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_apply_saldo_ajuste(date, numeric, text) TO authenticated;
