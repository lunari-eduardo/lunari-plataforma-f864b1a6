-- ==============================================================================
-- Migration: 20260829100000_fix_transacoes_valor_base.sql
-- Fase 5: Proteção robusta contra inflação de repasse de taxas
-- - Usa valor_principal da cobrança como prioridade sobre dados_extras JSON
-- - Corrige transações que inflaram a receita do estúdio no passado
-- ==============================================================================

-- 1. Modificar ensure_transaction_on_cobranca_paid
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
    
    -- FASE 4: O Asaas agora tem seu próprio fluxo no razão de gateway (gateway_cash_movements).
    -- Ignoramos a criação de clientes_transacoes se for Asaas.
    IF NEW.provedor = 'asaas' THEN
      RETURN NEW;
    END IF;

    v_finalidade := COALESCE(NEW.finalidade, 'sessao');
    v_is_extras   := (v_finalidade = 'fotos_extras');
    v_is_combined := (v_finalidade = 'sessao_e_extras');
    v_is_sinal    := (v_finalidade = 'sinal' OR COALESCE(NEW.descricao, '') ~* '(sinal|entrada|arras|reserva)');

    v_valor_base := NULL;
    
    -- FASE 5 FIX: Prioriza NEW.valor_principal sobre dados_extras, pois json parsing no frontend/adapters as vezes corrompe o valorBase
    IF NEW.valor_principal IS NOT NULL AND NEW.valor_principal > 0 THEN
      v_valor_base := NEW.valor_principal;
    ELSIF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'valorBase') IS NOT NULL THEN
      v_valor_base := (NEW.dados_extras->>'valorBase')::NUMERIC;
    END IF;

    v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
    v_repassar_antecipacao := COALESCE((NEW.dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
    END IF;

    v_valor_transacao := COALESCE(v_valor_base, NEW.valor);
    
    IF v_repassar_processamento AND v_repassar_antecipacao THEN
      v_taxa_gateway := 0;
      v_taxa_antecipacao := 0;
      v_valor_liquido := v_valor_transacao;
    ELSIF v_repassar_processamento THEN
      v_taxa_gateway := 0;
      IF v_taxa_antecipacao > 0 THEN
        v_valor_liquido := GREATEST(0, v_valor_transacao - v_taxa_antecipacao);
      ELSE
        v_valor_liquido := v_valor_transacao;
      END IF;
    ELSE
      IF NEW.valor_liquido IS NOT NULL AND NEW.valor_liquido > 0 AND NEW.valor_liquido < v_valor_transacao THEN
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

-- 2. Correção de transações infladas (Historico)
DO $$
DECLARE
  v_record RECORD;
BEGIN
  -- Encontra transacoes que foram afetadas (onde cobranca.valor_principal < transacao.valor)
  FOR v_record IN 
    SELECT t.id as tx_id, c.id as cobranca_id, c.valor_principal, c.valor as cobranca_valor, t.session_id, t.valor as old_tx_valor, t.valor_liquido as old_tx_liquido
    FROM public.clientes_transacoes t
    JOIN public.cobrancas c ON t.cobranca_id = c.id OR t.descricao ILIKE '%cobranca ' || c.id::text || '%'
    WHERE t.tipo = 'pagamento'
      AND c.valor_principal IS NOT NULL 
      AND c.valor_principal > 0
      AND c.valor_principal < t.valor
      AND c.provedor != 'asaas'
  LOOP
    -- Conserta o valor da transação para o valor principal
    UPDATE public.clientes_transacoes
    SET valor = v_record.valor_principal,
        -- Se o líquido era igual ao valor bruto anterior, corrige o líquido também
        valor_liquido = CASE WHEN valor_liquido = v_record.old_tx_valor THEN v_record.valor_principal ELSE valor_liquido END
    WHERE id = v_record.tx_id;

    -- Recalcula total_pago da sessão se a sessão for válida
    IF v_record.session_id IS NOT NULL THEN
      BEGIN
        PERFORM public.recompute_session_paid(v_record.session_id);
      EXCEPTION WHEN OTHERS THEN
        -- ignora erros individuais
      END;
    END IF;
  END LOOP;
END;
$$;
