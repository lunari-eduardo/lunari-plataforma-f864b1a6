-- 1) Tabela de saldos iniciais manuais por ano
CREATE TABLE IF NOT EXISTS public.fin_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  valor numeric(14,2) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','auto_rollover')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_opening_balances TO authenticated;
GRANT ALL ON public.fin_opening_balances TO service_role;

ALTER TABLE public.fin_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opening_balances_select_own" ON public.fin_opening_balances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "opening_balances_insert_own" ON public.fin_opening_balances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "opening_balances_update_own" ON public.fin_opening_balances
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "opening_balances_delete_own" ON public.fin_opening_balances
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger updated_at (reutiliza helper existente se disponível, senão cria)
CREATE OR REPLACE FUNCTION public.tg_fin_opening_balances_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS fin_opening_balances_set_updated_at ON public.fin_opening_balances;
CREATE TRIGGER fin_opening_balances_set_updated_at
  BEFORE UPDATE ON public.fin_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.tg_fin_opening_balances_updated_at();

-- 2) RPC leitura em cascata
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
    SELECT COALESCE(SUM(CASE
        WHEN fi.grupo_principal IN ('Receita Não Operacional','Receita Operacional') THEN ft.valor
        WHEN fi.grupo_principal IN ('Despesa Fixa','Despesa Variável','Investimento') THEN -ft.valor
        ELSE 0 END), 0)
      INTO _partial
      FROM public.fin_transactions ft
      JOIN public.financial_items fi ON fi.id = ft.item_id
     WHERE ft.user_id = _uid
       AND ft.status = 'Pago'
       AND date_part('year', ft.data_vencimento) = _prev;

    _rollover := _rollover + _partial;

    -- Se o ano anterior tem override manual, ele é a âncora
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

-- 3) RPC write helpers
CREATE OR REPLACE FUNCTION public.finance_set_opening_balance(_ano int, _valor numeric, _observacoes text DEFAULT NULL)
RETURNS public.fin_opening_balances
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.fin_opening_balances;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _ano < 2000 OR _ano > 2100 THEN RAISE EXCEPTION 'ano inválido'; END IF;

  INSERT INTO public.fin_opening_balances (user_id, ano, valor, origem, observacoes)
  VALUES (_uid, _ano, _valor, 'manual', _observacoes)
  ON CONFLICT (user_id, ano)
  DO UPDATE SET valor = EXCLUDED.valor,
                origem = 'manual',
                observacoes = EXCLUDED.observacoes,
                updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_set_opening_balance(int, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_clear_opening_balance(_ano int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.fin_opening_balances WHERE user_id = _uid AND ano = _ano;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_clear_opening_balance(int) TO authenticated;