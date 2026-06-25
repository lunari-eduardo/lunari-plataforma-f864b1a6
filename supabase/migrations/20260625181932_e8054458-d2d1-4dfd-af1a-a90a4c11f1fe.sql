-- Rollback parcial da segregação introduzida em 20260625005626.
-- Extras de galerias vinculadas a uma sessão devem somar em valor_pago da sessão.
-- Apenas extras "soltos" (galeria sem session_id) ficam com session_id=NULL.

CREATE OR REPLACE FUNCTION public.ensure_transaction_on_cobranca_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_text TEXT;
  v_cliente_id UUID;
  v_existing_tx UUID;
  v_valor_transacao NUMERIC;
  v_valor_liquido NUMERIC;
  v_taxa_gateway NUMERIC;
  v_taxa_antecipacao NUMERIC;
  v_provedor_label TEXT;
  v_is_extras BOOLEAN;
  v_galeria_session_id TEXT;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN

    v_is_extras := (COALESCE(NEW.finalidade, 'sessao') = 'fotos_extras');

    v_valor_transacao := NEW.valor;
    v_valor_liquido := NEW.valor_liquido;

    IF v_valor_liquido IS NOT NULL AND v_valor_liquido > 0 THEN
      v_taxa_gateway := ROUND(v_valor_transacao - v_valor_liquido, 2);
    ELSE
      v_taxa_gateway := 0;
    END IF;

    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
      IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
        v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
      END IF;
    END IF;

    -- 1) Resolver via NEW.session_id (cobrança já carrega referência)
    IF NEW.session_id IS NOT NULL THEN
      SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
      FROM public.clientes_sessoes
      WHERE session_id = NEW.session_id OR id::text = NEW.session_id
      LIMIT 1;
    END IF;

    -- 2) Fallback (relevante para extras): resolver via galeria vinculada
    IF v_session_text IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT session_id INTO v_galeria_session_id
      FROM public.galerias
      WHERE id = NEW.galeria_id
      LIMIT 1;

      IF v_galeria_session_id IS NOT NULL THEN
        SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
        FROM public.clientes_sessoes
        WHERE session_id = v_galeria_session_id OR id::text = v_galeria_session_id
        LIMIT 1;
      END IF;
    END IF;

    -- Cliente: prioriza sessão; cai para galeria; cai para cobrança
    IF v_cliente_id IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT cliente_id INTO v_cliente_id
      FROM public.galerias
      WHERE id = NEW.galeria_id
      LIMIT 1;
    END IF;

    IF v_cliente_id IS NULL THEN
      v_cliente_id := NEW.cliente_id;
    END IF;

    IF v_cliente_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Idempotência primária: por cobranca_id
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE cobranca_id = NEW.id
    LIMIT 1;

    -- Fallback: cobranca UUID na descrição
    IF v_existing_tx IS NULL THEN
      SELECT id INTO v_existing_tx
      FROM public.clientes_transacoes
      WHERE tipo = 'pagamento'
        AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
      LIMIT 1;
    END IF;

    v_provedor_label := CASE
      WHEN NEW.provedor = 'infinitepay' THEN 'InfinitePay'
      WHEN NEW.provedor = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.provedor = 'asaas' THEN 'Asaas'
      WHEN NEW.provedor = 'manual' THEN COALESCE(NEW.metodo_manual, 'Manual')
      ELSE COALESCE(NEW.provedor, 'manual')
    END;

    -- Idempotência secundária: mesma sessão + valor + provedor
    IF v_existing_tx IS NULL AND v_session_text IS NOT NULL THEN
      SELECT id INTO v_existing_tx
      FROM public.clientes_transacoes
      WHERE session_id = v_session_text
        AND tipo = 'pagamento'
        AND valor = v_valor_transacao
        AND descricao ILIKE '%' || v_provedor_label || '%'
      LIMIT 1;
    END IF;

    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao,
        tipo, data_transacao, descricao, cobranca_id
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,  -- extras vinculados à sessão recebem session_id; soltos ficam NULL
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento, NOW()),
        CASE
          WHEN v_is_extras THEN 'Fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label
          ELSE 'Pagamento ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')'
        END,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: recupera session_id das transações de extras criadas órfãs após 25/06.
DO $$
DECLARE
  v_count_before INT;
  v_count_updated INT;
BEGIN
  SELECT count(*) INTO v_count_before
  FROM public.clientes_transacoes t
  JOIN public.cobrancas c ON c.id = t.cobranca_id
  WHERE c.finalidade = 'fotos_extras' AND t.session_id IS NULL;

  RAISE NOTICE 'Transações de extras órfãs antes do backfill: %', v_count_before;

  WITH updated AS (
    UPDATE public.clientes_transacoes t
    SET session_id = sub.resolved_session_id
    FROM (
      SELECT
        t2.id AS tx_id,
        COALESCE(
          cs1.session_id,
          cs2.session_id
        ) AS resolved_session_id
      FROM public.clientes_transacoes t2
      JOIN public.cobrancas c ON c.id = t2.cobranca_id
      LEFT JOIN public.clientes_sessoes cs1
        ON c.session_id IS NOT NULL
       AND (cs1.session_id = c.session_id OR cs1.id::text = c.session_id)
      LEFT JOIN public.galerias g ON g.id = c.galeria_id
      LEFT JOIN public.clientes_sessoes cs2
        ON g.session_id IS NOT NULL
       AND (cs2.session_id = g.session_id OR cs2.id::text = g.session_id)
      WHERE c.finalidade = 'fotos_extras'
        AND t2.session_id IS NULL
    ) sub
    WHERE t.id = sub.tx_id
      AND sub.resolved_session_id IS NOT NULL
    RETURNING t.session_id
  )
  SELECT count(*) INTO v_count_updated FROM updated;

  RAISE NOTICE 'Transações de extras religadas à sessão: %', v_count_updated;

  -- Recompute valor_pago das sessões afetadas (inline, sem usar a função com guard auth.uid())
  UPDATE public.clientes_sessoes s
  SET valor_pago = (
    SELECT COALESCE(SUM(valor), 0)
    FROM public.clientes_transacoes
    WHERE session_id = s.session_id AND tipo = 'pagamento'
  )
  WHERE s.session_id IN (
    SELECT DISTINCT t.session_id
    FROM public.clientes_transacoes t
    JOIN public.cobrancas c ON c.id = t.cobranca_id
    WHERE c.finalidade = 'fotos_extras' AND t.session_id IS NOT NULL
  );
END $$;