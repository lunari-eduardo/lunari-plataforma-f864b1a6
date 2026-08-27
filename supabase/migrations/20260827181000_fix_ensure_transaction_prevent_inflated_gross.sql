-- ==============================================================================
-- Migration: 20260827181000_fix_ensure_transaction_prevent_inflated_gross.sql
-- Description: Ajusta o ensure_transaction_on_cobranca_paid para ler o valor real
-- nominal do produto a partir de dados_extras->>'valorBase'.
-- Quando ha repasse de taxas no frontend transparente, a coluna alor e gravada
-- com o valor_inflado (ex: 10.79), o que causa volume irreal na receita.
-- ==============================================================================

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
  v_is_sinal BOOLEAN;
  v_galeria_session_id TEXT;
  v_repassar_processamento BOOLEAN;
  v_repassar_antecipacao BOOLEAN;
  v_custom_desc TEXT;
  v_valor_base NUMERIC;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN

    v_finalidade := COALESCE(NEW.finalidade, 'sessao');
    v_is_extras   := (v_finalidade = 'fotos_extras');
    v_is_combined := (v_finalidade = 'sessao_e_extras');
    v_is_sinal    := (v_finalidade = 'sinal' OR COALESCE(NEW.descricao, '') ~* '(sinal|entrada|arras|reserva)');

    -- Se o frontend enviou o valor real nominal no valorBase, usamos ele como ancora
    v_valor_base := NULL;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'valorBase') IS NOT NULL THEN
      v_valor_base := (NEW.dados_extras->>'valorBase')::NUMERIC;
    END IF;

    -- Extrair flags de repasse de taxas de dados_extras
    v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
    v_repassar_antecipacao := COALESCE((NEW.dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
    END IF;

    -- O valor da transacao no extrato DEVE ser o valorBase caso as taxas tenham sido adicionadas ao total
    v_valor_transacao := COALESCE(v_valor_base, NEW.valor);
    
    -- O backend e webhooks setam NEW.valor_liquido, mas esse calculo pode estar inflado tb.
    -- Vamos derivar o valor liquido de forma segura a partir do valor nominal da transacao.
    IF v_repassar_processamento AND v_repassar_antecipacao THEN
      -- Cliente pagou todas as taxas -> Fotografo recebe valor nominal integral
      v_taxa_gateway := 0;
      v_taxa_antecipacao := 0;
      v_valor_liquido := v_valor_transacao;
    ELSIF v_repassar_processamento THEN
      -- Processamento repassado ao cliente, fotografo absorve apenas antecipacao se houver
      v_taxa_gateway := 0;
      IF v_taxa_antecipacao > 0 THEN
        v_valor_liquido := GREATEST(0, v_valor_transacao - v_taxa_antecipacao);
      ELSE
        v_valor_liquido := v_valor_transacao;
      END IF;
    ELSE
      -- Fotografo absorveu as taxas. 
      -- Se a integracao for transparente o NEW.valor_liquido estara correto em relacao ao valor bruto 
      -- caso o asaas envie. Mas se usarmos v_valor_base, temos que ver a diferenca.
      IF NEW.valor_liquido IS NOT NULL AND NEW.valor_liquido > 0 AND NEW.valor_liquido < v_valor_transacao THEN
        -- Como a taxa total foi absorvida, usamos o NEW.valor_liquido que os adaptadores calcularam
        v_valor_liquido := NEW.valor_liquido;
        v_taxa_gateway := GREATEST(0, ROUND(v_valor_transacao - v_valor_liquido, 2));
        IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
          v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
        END IF;
      ELSE
        v_valor_liquido := v_valor_transacao;
        v_taxa_gateway := 0;
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

    -- Idempotencia estrita
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

    v_custom_desc := COALESCE(NULLIF(TRIM(NEW.descricao), ''), '');

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
          WHEN v_is_combined THEN 'Sessão + fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          WHEN v_is_extras   THEN 'Fotos extras (cobranca ' || NEW.id::text || ') ' || v_provedor_label || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          WHEN v_is_sinal    THEN 'Sinal ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')' || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
          ELSE 'Pagamento ' || v_provedor_label || ' (cobranca ' || NEW.id::text || ')' || CASE WHEN v_custom_desc <> '' THEN ' - ' || v_custom_desc ELSE '' END
        END,
        NEW.id
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET
        valor = v_valor_transacao,
        valor_liquido = v_valor_liquido,
        taxa_gateway = v_taxa_gateway,
        taxa_antecipacao = v_taxa_antecipacao,
        data_transacao = COALESCE(NEW.data_pagamento, data_transacao)
      WHERE id = v_existing_tx;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
