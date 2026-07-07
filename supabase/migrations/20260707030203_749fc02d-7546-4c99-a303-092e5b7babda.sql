
-- Etapa 2/5 — RPC canônica + trigger de transação passam a reconhecer
-- finalidade='sessao_e_extras'. Retro-compat total: nenhuma cobrança
-- existente usa esse valor, então o resultado numérico é IDÊNTICO para
-- galerias/transações que já existem.

-- 1) calculate_gallery_extra_payment: soma também o componente de extras
--    de cobranças combinadas quando confirmadas como pagas.
CREATE OR REPLACE FUNCTION public.calculate_gallery_extra_payment(p_gallery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_g RECORD;
  v_regras jsonb;
  v_rules_source text := 'gallery_fixed';
  v_sess RECORD;
  v_selected int := 0;
  v_included int := 0;
  v_charge_type text := 'only_extras';
  v_extras_necess int := 0;
  v_extras_pagas int := 0;
  v_extras_a_cobrar int := 0;
  v_valor_pago numeric := 0;
  v_unit numeric := 0;
  v_ideal numeric := 0;
  v_a_cobrar numeric := 0;
  v_is_fully_paid boolean := false;
BEGIN
  SELECT id, user_id, fotos_incluidas, fotos_selecionadas,
         valor_foto_extra, regras_congeladas, session_id,
         total_fotos_extras_vendidas, valor_total_vendido,
         venda_tipo_cobranca, configuracoes
  INTO v_g FROM galerias WHERE id = p_gallery_id;
  IF v_g IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  v_selected := COALESCE(v_g.fotos_selecionadas, 0);
  v_included := COALESCE(v_g.fotos_incluidas, 0);

  v_charge_type := COALESCE(
    v_g.venda_tipo_cobranca,
    NULLIF(v_g.configuracoes->'saleSettings'->>'chargeType', ''),
    'only_extras'
  );
  IF v_charge_type NOT IN ('all_selected','only_extras') THEN
    v_charge_type := 'only_extras';
  END IF;

  IF v_charge_type = 'all_selected' THEN
    v_extras_necess := v_selected;
  ELSE
    v_extras_necess := GREATEST(0, v_selected - v_included);
  END IF;

  v_regras := v_g.regras_congeladas;
  IF v_regras IS NOT NULL THEN
    v_rules_source := 'gallery_frozen';
  ELSIF v_g.session_id IS NOT NULL THEN
    SELECT regras_congeladas INTO v_sess FROM clientes_sessoes
     WHERE session_id = v_g.session_id LIMIT 1;
    IF v_sess.regras_congeladas IS NOT NULL THEN
      v_regras := v_sess.regras_congeladas;
      v_rules_source := 'session_frozen';
    END IF;
  END IF;

  -- Soma cobranças pagas de extras desta galeria (fonte única):
  -- inclui finalidade='fotos_extras' (valor integral) e
  -- finalidade='sessao_e_extras' (apenas o componente de extras).
  SELECT
    COALESCE(SUM(
      CASE finalidade
        WHEN 'fotos_extras'    THEN valor
        WHEN 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
        ELSE 0
      END
    ), 0)::numeric,
    COALESCE(SUM(COALESCE(NULLIF(qtd_fotos, 0), 0)), 0)::int
    INTO v_valor_pago, v_extras_pagas
   FROM cobrancas
   WHERE galeria_id = p_gallery_id
     AND finalidade IN ('fotos_extras','sessao_e_extras')
     AND status IN ('pago', 'pago_manual');

  v_extras_a_cobrar := GREATEST(0, v_extras_necess - v_extras_pagas);

  v_unit := public._extra_unit_price_for_quantity(v_regras, v_g.valor_foto_extra, v_extras_necess);
  v_ideal := ROUND((v_extras_necess * v_unit)::numeric, 2);
  v_a_cobrar := GREATEST(0, ROUND((v_ideal - v_valor_pago)::numeric, 2));

  v_is_fully_paid := (v_a_cobrar <= 0);

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', p_gallery_id,
    'user_id', v_g.user_id,
    'session_id', v_g.session_id,
    'charge_type', v_charge_type,
    'selected_count', v_selected,
    'included_count', v_included,
    'extras_necessarias', v_extras_necess,
    'extras_pagas', v_extras_pagas,
    'extras_a_cobrar', v_extras_a_cobrar,
    'valor_pago', v_valor_pago,
    'valor_unitario', v_unit,
    'valor_total_ideal', v_ideal,
    'valor_a_cobrar', v_a_cobrar,
    'is_fully_paid', v_is_fully_paid,
    'rules_source', v_rules_source
  );
END;
$function$;


-- 2) ensure_transaction_on_cobranca_paid: mesma lógica; só rotula a
--    descrição da transação quando finalidade='sessao_e_extras'.
--    Mantém idempotência por cobranca_id + descrição.
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
  v_finalidade TEXT;
  v_is_extras BOOLEAN;
  v_is_combined BOOLEAN;
  v_galeria_session_id TEXT;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN

    v_finalidade := COALESCE(NEW.finalidade, 'sessao');
    v_is_extras   := (v_finalidade = 'fotos_extras');
    v_is_combined := (v_finalidade = 'sessao_e_extras');

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

    IF NEW.session_id IS NOT NULL THEN
      SELECT session_id, cliente_id INTO v_session_text, v_cliente_id
      FROM public.clientes_sessoes
      WHERE session_id = NEW.session_id OR id::text = NEW.session_id
      LIMIT 1;
    END IF;

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

    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE cobranca_id = NEW.id
    LIMIT 1;

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
        v_session_text,
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento, NOW()),
        CASE
          WHEN v_is_combined THEN 'Sessão + fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label
          WHEN v_is_extras   THEN 'Fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label
          ELSE 'Pagamento ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')'
        END,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
