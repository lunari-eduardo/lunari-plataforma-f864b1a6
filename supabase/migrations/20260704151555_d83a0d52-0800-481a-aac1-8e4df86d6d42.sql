
-- ============================================================
-- FASE 1: Sistema de Crédito do Cliente (Ledger)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela append-only: cliente_creditos_ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cliente_creditos_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric NOT NULL,
  origem text NOT NULL,
  session_id_origem text NULL REFERENCES public.clientes_sessoes(session_id) ON DELETE SET NULL,
  session_id_consumo text NULL REFERENCES public.clientes_sessoes(session_id) ON DELETE SET NULL,
  transacao_id uuid NULL REFERENCES public.clientes_transacoes(id) ON DELETE SET NULL,
  descricao text,
  expira_em date NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_credit_valor_nonzero CHECK (valor <> 0),
  CONSTRAINT ck_credit_origem CHECK (origem IN (
    'overpay',
    'reducao_escopo',
    'reconcile_sobra',
    'estorno_para_credito',
    'ajuste_manual',
    'consumo_desconto',
    'expiracao',
    'reversao_consumo',
    'reversao_grant'
  )),
  CONSTRAINT ck_credit_consumo_requires_sessao CHECK (
    origem <> 'consumo_desconto' OR session_id_consumo IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_cliente
  ON public.cliente_creditos_ledger(user_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_cliente_data
  ON public.cliente_creditos_ledger(cliente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_session_origem
  ON public.cliente_creditos_ledger(session_id_origem);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_session_consumo
  ON public.cliente_creditos_ledger(session_id_consumo);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_transacao
  ON public.cliente_creditos_ledger(transacao_id);

GRANT SELECT, INSERT ON public.cliente_creditos_ledger TO authenticated;
GRANT ALL ON public.cliente_creditos_ledger TO service_role;

ALTER TABLE public.cliente_creditos_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own credit ledger"
  ON public.cliente_creditos_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT direto do usuário é permitido só para ajuste manual (RPCs usam service_role via SECURITY DEFINER).
CREATE POLICY "user inserts ajuste_manual credit"
  ON public.cliente_creditos_ledger
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND origem = 'ajuste_manual');

-- Sem UPDATE nem DELETE por design (ledger append-only).

-- ------------------------------------------------------------
-- 2) Coluna denormalizada em clientes_sessoes
-- ------------------------------------------------------------
ALTER TABLE public.clientes_sessoes
  ADD COLUMN IF NOT EXISTS credito_aplicado numeric NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 3) View v_cliente_saldo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_cliente_saldo AS
SELECT
  user_id,
  cliente_id,
  COALESCE(SUM(valor), 0)::numeric AS saldo,
  MIN(expira_em) FILTER (WHERE valor > 0 AND expira_em IS NOT NULL) AS proxima_expiracao,
  MAX(created_at) AS ultima_movimentacao
FROM public.cliente_creditos_ledger
GROUP BY user_id, cliente_id;

GRANT SELECT ON public.v_cliente_saldo TO authenticated;

-- ------------------------------------------------------------
-- 4) Helper: valor pago externo (exclui consumos de crédito)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_valor_pago_externo(p_session_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(t.valor), 0)
  FROM public.clientes_transacoes t
  WHERE t.session_id = p_session_id
    AND t.tipo IN ('pagamento', 'ajuste', 'estorno')
    AND NOT EXISTS (
      SELECT 1 FROM public.cliente_creditos_ledger l
      WHERE l.transacao_id = t.id
        AND l.origem = 'consumo_desconto'
    );
$$;

-- ------------------------------------------------------------
-- 5) RPC: grant_client_credit
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_client_credit(
  p_cliente_id uuid,
  p_valor numeric,
  p_origem text,
  p_session_origem text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_expira_em date DEFAULT NULL,
  p_transacao_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_ledger_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor = 0 THEN
    RAISE EXCEPTION 'Valor de crédito não pode ser zero';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.clientes
  WHERE id = p_cliente_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- Se chamado por usuário autenticado (não trigger), valida ownership
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão para conceder crédito a este cliente';
  END IF;

  INSERT INTO public.cliente_creditos_ledger (
    user_id, cliente_id, data, valor, origem,
    session_id_origem, transacao_id, descricao, expira_em, created_by
  ) VALUES (
    v_user_id, p_cliente_id, CURRENT_DATE, p_valor, p_origem,
    p_session_origem, p_transacao_id, p_descricao, p_expira_em, COALESCE(auth.uid(), v_user_id)
  )
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_client_credit(uuid, numeric, text, text, text, date, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 6) RPC: apply_client_credit  (consumir crédito em uma sessão)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_client_credit(
  p_cliente_id uuid,
  p_session_id text,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Valida sessão
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

  -- Cria transação de pagamento via crédito (tipo=ajuste, marcado no descricao)
  INSERT INTO public.clientes_transacoes (
    cliente_id, session_id, user_id, valor, data_transacao, tipo, descricao, updated_by
  ) VALUES (
    p_cliente_id, p_session_id, v_user_id, v_valor_aplicar, CURRENT_DATE,
    'ajuste',
    'Crédito do cliente aplicado',
    v_user_id
  )
  RETURNING id INTO v_transacao_id;

  -- Insere consumo no ledger
  INSERT INTO public.cliente_creditos_ledger (
    user_id, cliente_id, data, valor, origem,
    session_id_consumo, transacao_id, descricao, created_by
  ) VALUES (
    v_user_id, p_cliente_id, CURRENT_DATE, -v_valor_aplicar, 'consumo_desconto',
    p_session_id, v_transacao_id,
    'Consumo em sessão ' || p_session_id, v_user_id
  )
  RETURNING id INTO v_ledger_id;

  -- Atualiza denormalizado
  UPDATE public.clientes_sessoes
     SET credito_aplicado = COALESCE(credito_aplicado, 0) + v_valor_aplicar
   WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'transacao_id', v_transacao_id,
    'ledger_id', v_ledger_id,
    'valor_aplicado', v_valor_aplicar,
    'novo_saldo', v_saldo - v_valor_aplicar
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_client_credit(uuid, text, numeric) TO authenticated;

-- ------------------------------------------------------------
-- 7) RPC: revoke_client_credit  (reverte um lançamento)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_client_credit(
  p_ledger_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_row public.cliente_creditos_ledger%ROWTYPE;
  v_new_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_row FROM public.cliente_creditos_ledger WHERE id = p_ledger_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  IF v_row.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.cliente_creditos_ledger (
    user_id, cliente_id, data, valor, origem,
    session_id_origem, session_id_consumo, transacao_id, descricao, created_by
  ) VALUES (
    v_row.user_id, v_row.cliente_id, CURRENT_DATE, -v_row.valor,
    CASE WHEN v_row.origem = 'consumo_desconto' THEN 'reversao_consumo' ELSE 'reversao_grant' END,
    v_row.session_id_origem, v_row.session_id_consumo, v_row.transacao_id,
    COALESCE('Reversão: ' || p_motivo, 'Reversão de lançamento ' || p_ledger_id::text),
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_client_credit(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 8) Trigger: gera crédito automático em overpay / redução de escopo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_credit_overpay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Determina session_id afetado
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

  -- Soma de crédito automático já lançado para esta sessão
  SELECT COALESCE(SUM(valor), 0) INTO v_credito_atual
  FROM public.cliente_creditos_ledger
  WHERE session_id_origem = v_session_id
    AND origem IN ('overpay', 'reducao_escopo');

  v_ajuste := v_delta_desejado - v_credito_atual;

  IF v_ajuste = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_ajuste > 0 THEN
    -- Novo overpay ou aumento
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
    -- v_ajuste < 0: crédito automático deve diminuir. Só permite se não foi consumido além do saldo restante.
    -- Insere reversão parcial (limite: v_credito_atual, para não deixar negativo)
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

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_credit_on_transacoes ON public.clientes_transacoes;
CREATE TRIGGER trg_auto_credit_on_transacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_credit_overpay();

DROP TRIGGER IF EXISTS trg_auto_credit_on_sessoes ON public.clientes_sessoes;
CREATE TRIGGER trg_auto_credit_on_sessoes
  AFTER UPDATE OF valor_total ON public.clientes_sessoes
  FOR EACH ROW
  WHEN (NEW.valor_total IS DISTINCT FROM OLD.valor_total)
  EXECUTE FUNCTION public.trg_auto_credit_overpay();

-- ------------------------------------------------------------
-- 9) Trigger: mantém credito_aplicado denormalizado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_credito_aplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id text;
  v_total numeric;
BEGIN
  v_session_id := COALESCE(NEW.session_id_consumo, OLD.session_id_consumo);
  IF v_session_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(-valor), 0) INTO v_total
  FROM public.cliente_creditos_ledger
  WHERE session_id_consumo = v_session_id
    AND origem IN ('consumo_desconto', 'reversao_consumo');

  UPDATE public.clientes_sessoes
     SET credito_aplicado = GREATEST(v_total, 0)
   WHERE session_id = v_session_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credito_aplicado ON public.cliente_creditos_ledger;
CREATE TRIGGER trg_sync_credito_aplicado
  AFTER INSERT ON public.cliente_creditos_ledger
  FOR EACH ROW
  WHEN (NEW.session_id_consumo IS NOT NULL)
  EXECUTE FUNCTION public.trg_sync_credito_aplicado();

-- ------------------------------------------------------------
-- 10) Ajuste em reconcile_session_extras: grant real de crédito
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_session_extras(
  p_session_id uuid,
  p_qtd_extras integer,
  p_valor_unitario numeric,
  p_destino_sobra text DEFAULT 'manter_credito',
  p_valor_sobra numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_user_id uuid;
  v_total_extras numeric;
  v_old_adicional numeric;
  v_old_desconto numeric;
  v_new_adicional numeric;
  v_new_desconto numeric;
  v_credit_ledger_id uuid;
BEGIN
  IF p_qtd_extras < 0 OR p_valor_unitario < 0 OR p_valor_sobra < 0 THEN
    RAISE EXCEPTION 'Valores não podem ser negativos';
  END IF;

  IF p_destino_sobra NOT IN ('adicional', 'desconto_negativo', 'manter_credito') THEN
    RAISE EXCEPTION 'Destino da sobra inválido';
  END IF;

  SELECT * INTO v_session FROM public.clientes_sessoes WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL OR v_user_id <> v_session.user_id THEN
    RAISE EXCEPTION 'Sem permissão para reconciliar esta sessão';
  END IF;

  v_total_extras := ROUND((p_qtd_extras * p_valor_unitario)::numeric, 2);
  v_old_adicional := COALESCE(v_session.valor_adicional, 0);
  v_old_desconto := COALESCE(v_session.desconto, 0);
  v_new_adicional := v_old_adicional;
  v_new_desconto := v_old_desconto;

  IF p_destino_sobra = 'adicional' THEN
    v_new_adicional := v_old_adicional + p_valor_sobra;
  ELSIF p_destino_sobra = 'desconto_negativo' THEN
    v_new_desconto := v_old_desconto - p_valor_sobra;
  END IF;

  UPDATE public.clientes_sessoes SET
    qtd_fotos_extra = p_qtd_extras,
    valor_foto_extra = p_valor_unitario,
    valor_total_foto_extra = v_total_extras,
    valor_adicional = v_new_adicional,
    desconto = v_new_desconto,
    regras_congeladas = CASE
      WHEN regras_congeladas IS NOT NULL
           AND jsonb_typeof(regras_congeladas->'pacote') = 'object'
      THEN jsonb_set(
             regras_congeladas,
             '{pacote,valorFotoExtraEfetivo}',
             to_jsonb(p_valor_unitario),
             true
           )
      ELSE regras_congeladas
    END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_session_id;

  -- Se destino = manter_credito e há sobra, grant no ledger
  IF p_destino_sobra = 'manter_credito' AND p_valor_sobra > 0 AND v_session.cliente_id IS NOT NULL THEN
    INSERT INTO public.cliente_creditos_ledger (
      user_id, cliente_id, data, valor, origem,
      session_id_origem, descricao, created_by
    ) VALUES (
      v_session.user_id, v_session.cliente_id, CURRENT_DATE, p_valor_sobra,
      'reconcile_sobra', v_session.session_id,
      'Sobra de reconciliação de fotos extras',
      v_user_id
    )
    RETURNING id INTO v_credit_ledger_id;
  END IF;

  INSERT INTO public.audit_log(action, resource_type, resource_id, actor_id, actor_type, gallery_id, metadata)
  VALUES(
    'reconcile_credit',
    'sessao',
    p_session_id,
    v_user_id,
    'user',
    v_session.galeria_id,
    jsonb_build_object(
      'qtd_extras', p_qtd_extras,
      'valor_unitario', p_valor_unitario,
      'total_extras', v_total_extras,
      'destino_sobra', p_destino_sobra,
      'valor_sobra', p_valor_sobra,
      'old_adicional', v_old_adicional,
      'new_adicional', v_new_adicional,
      'old_desconto', v_old_desconto,
      'new_desconto', v_new_desconto,
      'credit_ledger_id', v_credit_ledger_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'qtd_extras', p_qtd_extras,
    'valor_unitario', p_valor_unitario,
    'total_extras', v_total_extras,
    'novo_adicional', v_new_adicional,
    'novo_desconto', v_new_desconto,
    'credit_ledger_id', v_credit_ledger_id
  );
END;
$$;

-- ------------------------------------------------------------
-- 11) Realtime publication
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cliente_creditos_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_creditos_ledger;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 12) Migração histórica: materializar overpays existentes
-- ------------------------------------------------------------
INSERT INTO public.cliente_creditos_ledger (
  user_id, cliente_id, data, valor, origem,
  session_id_origem, descricao, created_by, created_at
)
SELECT
  cs.user_id,
  cs.cliente_id,
  CURRENT_DATE,
  ROUND((cs.valor_pago - cs.valor_total)::numeric, 2),
  'overpay',
  cs.session_id,
  'Migração inicial — overpay histórico detectado',
  cs.user_id,
  now()
FROM public.clientes_sessoes cs
WHERE cs.valor_pago > cs.valor_total
  AND cs.valor_total > 0
  AND cs.cliente_id IS NOT NULL
  AND cs.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_creditos_ledger l
    WHERE l.session_id_origem = cs.session_id AND l.origem = 'overpay'
  );
