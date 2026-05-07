
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
  v_valor_liquido_photographer NUMERIC;
  v_taxa_gateway NUMERIC;
  v_taxa_antecipacao NUMERIC;
  v_session_exists BOOLEAN;
  v_provedor_label TEXT;
  v_repassar_processamento BOOLEAN;
  v_repassar_antecipacao BOOLEAN;
  v_sum_taxa_gateway NUMERIC;
  v_sum_taxa_antecipacao NUMERIC;
  v_sum_valor_liquido NUMERIC;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN
    v_valor_transacao := NEW.valor;
    v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
    v_repassar_antecipacao := COALESCE((NEW.dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

    IF NEW.provedor = 'asaas' THEN
      SELECT COALESCE(SUM(cp.taxa_gateway),0), COALESCE(SUM(cp.taxa_antecipacao),0), COALESCE(SUM(cp.valor_liquido),0)
      INTO v_sum_taxa_gateway, v_sum_taxa_antecipacao, v_sum_valor_liquido
      FROM public.cobranca_parcelas cp
      WHERE cp.cobranca_id = NEW.id AND cp.status IN ('confirmado','recebido','antecipado');

      IF v_repassar_processamento THEN v_taxa_gateway := 0; ELSE v_taxa_gateway := v_sum_taxa_gateway; END IF;
      IF v_repassar_antecipacao THEN v_taxa_antecipacao := 0; ELSE v_taxa_antecipacao := v_sum_taxa_antecipacao; END IF;
      v_valor_liquido_photographer := v_valor_transacao - v_taxa_gateway - v_taxa_antecipacao;
    ELSE
      IF NEW.valor_liquido IS NOT NULL AND NEW.valor_liquido > 0 THEN
        v_taxa_gateway := ROUND(v_valor_transacao - NEW.valor_liquido, 2);
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
      v_valor_liquido_photographer := COALESCE(NEW.valor_liquido, v_valor_transacao);
    END IF;

    IF NEW.session_id IS NOT NULL THEN
      SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
      FROM public.clientes_sessoes
      WHERE session_id = NEW.session_id OR id::text = NEW.session_id LIMIT 1;
    END IF;
    v_session_exists := (v_session_text IS NOT NULL);

    IF v_cliente_id IS NULL AND NEW.galeria_id IS NOT NULL THEN
      SELECT cliente_id INTO v_cliente_id FROM public.galerias WHERE id = NEW.galeria_id LIMIT 1;
    END IF;
    IF v_cliente_id IS NULL THEN v_cliente_id := NEW.cliente_id; END IF;
    IF v_cliente_id IS NULL THEN RETURN NEW; END IF;
    IF NOT v_session_exists THEN v_session_text := NULL; END IF;

    SELECT id INTO v_existing_tx FROM public.clientes_transacoes WHERE cobranca_id = NEW.id LIMIT 1;
    IF v_existing_tx IS NULL THEN
      SELECT id INTO v_existing_tx FROM public.clientes_transacoes
      WHERE tipo='pagamento' AND descricao ILIKE '%cobranca ' || NEW.id::text || '%' LIMIT 1;
    END IF;

    v_provedor_label := CASE
      WHEN NEW.provedor='infinitepay' THEN 'InfinitePay'
      WHEN NEW.provedor='mercadopago' THEN 'Mercado Pago'
      WHEN NEW.provedor='asaas' THEN 'Asaas'
      WHEN NEW.provedor='manual' THEN COALESCE(NEW.metodo_manual,'Manual')
      ELSE COALESCE(NEW.provedor,'manual')
    END;

    IF v_existing_tx IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao,
        tipo, data_transacao, descricao, cobranca_id
      ) VALUES (
        NEW.user_id, v_cliente_id, v_session_text, v_valor_transacao, v_valor_liquido_photographer,
        v_taxa_gateway, v_taxa_antecipacao, 'pagamento',
        COALESCE(NEW.data_pagamento::date, CURRENT_DATE),
        FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]', v_provedor_label, NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END),
        NEW.id
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET valor_liquido = v_valor_liquido_photographer,
          taxa_gateway = v_taxa_gateway,
          taxa_antecipacao = v_taxa_antecipacao,
          cobranca_id = COALESCE(cobranca_id, NEW.id)
      WHERE id = v_existing_tx;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_clientes_transacoes_cobranca_id
  ON public.clientes_transacoes (cobranca_id) WHERE cobranca_id IS NOT NULL;

-- Backfill apenas para cobranças cuja sessão existe
INSERT INTO public.clientes_transacoes (
  user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao,
  tipo, data_transacao, descricao, cobranca_id
)
SELECT
  c.user_id,
  COALESCE(cs.cliente_id, g.cliente_id, c.cliente_id),
  cs.session_id,
  c.valor,
  COALESCE(c.valor_liquido, c.valor),
  GREATEST(COALESCE(c.valor - c.valor_liquido, 0), 0),
  0, 'pagamento',
  COALESCE(c.data_pagamento::date, CURRENT_DATE),
  FORMAT('Pagamento %s - cobranca %s%s [backfill]',
    CASE WHEN c.provedor='asaas' THEN 'Asaas'
         WHEN c.provedor='infinitepay' THEN 'InfinitePay'
         WHEN c.provedor='mercadopago' THEN 'Mercado Pago'
         WHEN c.provedor='manual' THEN COALESCE(c.metodo_manual,'Manual')
         ELSE COALESCE(c.provedor,'manual') END,
    c.id,
    CASE WHEN c.descricao IS NOT NULL THEN ' - ' || c.descricao ELSE '' END),
  c.id
FROM public.cobrancas c
JOIN public.clientes_sessoes cs ON (cs.session_id = c.session_id OR cs.id::text = c.session_id)
LEFT JOIN public.galerias g ON g.id = c.galeria_id
WHERE c.status IN ('pago','pago_manual')
  AND NOT EXISTS (SELECT 1 FROM public.clientes_transacoes t WHERE t.cobranca_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes_transacoes t
    WHERE t.tipo='pagamento' AND t.descricao ILIKE '%cobranca ' || c.id::text || '%'
  )
  AND COALESCE(cs.cliente_id, g.cliente_id, c.cliente_id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_session_payments(p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_inserted INT := 0;
BEGIN
  WITH inseridas AS (
    INSERT INTO public.clientes_transacoes (
      user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao,
      tipo, data_transacao, descricao, cobranca_id
    )
    SELECT
      c.user_id,
      COALESCE(cs.cliente_id, g.cliente_id, c.cliente_id),
      cs.session_id,
      c.valor,
      COALESCE(c.valor_liquido, c.valor),
      GREATEST(COALESCE(c.valor - c.valor_liquido, 0), 0),
      0, 'pagamento',
      COALESCE(c.data_pagamento::date, CURRENT_DATE),
      FORMAT('Pagamento %s - cobranca %s [reconcile]',
        CASE WHEN c.provedor='asaas' THEN 'Asaas'
             WHEN c.provedor='infinitepay' THEN 'InfinitePay'
             WHEN c.provedor='mercadopago' THEN 'Mercado Pago'
             WHEN c.provedor='manual' THEN COALESCE(c.metodo_manual,'Manual')
             ELSE COALESCE(c.provedor,'manual') END, c.id),
      c.id
    FROM public.cobrancas c
    JOIN public.clientes_sessoes cs ON (cs.session_id = c.session_id OR cs.id::text = c.session_id)
    LEFT JOIN public.galerias g ON g.id = c.galeria_id
    WHERE c.session_id = p_session_id
      AND c.status IN ('pago','pago_manual')
      AND NOT EXISTS (SELECT 1 FROM public.clientes_transacoes t WHERE t.cobranca_id = c.id)
      AND COALESCE(cs.cliente_id, g.cliente_id, c.cliente_id) IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inseridas;
  PERFORM public.recompute_session_paid(p_session_id);
  RETURN jsonb_build_object('inserted', v_inserted, 'session_id', p_session_id);
END;
$$;
