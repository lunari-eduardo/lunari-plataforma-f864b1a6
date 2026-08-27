-- ==============================================================================
-- Migration: Enriquecer classificação de origens de pagamento e extrato unificado
-- ==============================================================================

-- 1. Atualizar ensure_transaction_on_cobranca_paid para preservar a origem (Sinal, Sessão, Fotos Extras, etc.)
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
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN

    v_finalidade := COALESCE(NEW.finalidade, 'sessao');
    v_is_extras   := (v_finalidade = 'fotos_extras');
    v_is_combined := (v_finalidade = 'sessao_e_extras');
    v_is_sinal    := (v_finalidade = 'sinal' OR COALESCE(NEW.descricao, '') ~* '(sinal|entrada|arras|reserva)');

    v_valor_transacao := NEW.valor;
    v_valor_liquido := NEW.valor_liquido;

    -- Extrair flags de repasse de taxas de dados_extras
    v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
    v_repassar_antecipacao := COALESCE((NEW.dados_extras->>'repassarTaxaAntecipacao')::boolean, false);

    v_taxa_antecipacao := 0;
    IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'taxa_antecipacao') IS NOT NULL THEN
      v_taxa_antecipacao := (NEW.dados_extras->>'taxa_antecipacao')::NUMERIC;
    END IF;

    IF v_repassar_processamento AND v_repassar_antecipacao THEN
      -- Cliente pagou todas as taxas -> Fotógrafo recebe valor nominal integral, taxa_gateway = 0
      v_taxa_gateway := 0;
      v_taxa_antecipacao := 0;
      v_valor_liquido := v_valor_transacao;
    ELSIF v_repassar_processamento THEN
      -- Processamento repassado ao cliente, fotógrafo absorve apenas antecipação se houver
      v_taxa_gateway := 0;
      IF v_taxa_antecipacao > 0 THEN
        v_valor_liquido := GREATEST(0, v_valor_transacao - v_taxa_antecipacao);
      ELSE
        v_valor_liquido := v_valor_transacao;
      END IF;
    ELSE
      -- Fotógrafo absorveu as taxas
      IF v_valor_liquido IS NOT NULL AND v_valor_liquido > 0 THEN
        v_taxa_gateway := ROUND(v_valor_transacao - v_valor_liquido, 2);
        IF v_taxa_antecipacao > 0 AND v_taxa_gateway >= v_taxa_antecipacao THEN
          v_taxa_gateway := v_taxa_gateway - v_taxa_antecipacao;
        END IF;
      ELSE
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


-- 2. Recriar a view extrato_unificado com classificação robusta de escopo/origem
CREATE OR REPLACE VIEW public.extrato_unificado AS
 SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
        CASE
            WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
            WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
            ELSE 'workflow'::text
        END AS origem,
    c.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    NULL::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento,
    'pagamento'::text AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
  WHERE ct.tipo = 'pagamento'::text
UNION ALL
 SELECT ct.id::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    COALESCE(NULLIF(btrim(regexp_replace(regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]'::text, ''::text, 'g'::text), '\s*\(cobranca [0-9a-fA-F-]+\)\s*'::text, ' '::text, 'g'::text)), ''::text), 'Estorno'::text) AS descricao,
        CASE
            WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
            WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text OR (cs.galeria_id IS NOT NULL AND ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text) THEN 'gallery'::text
            ELSE 'workflow'::text
        END AS origem,
    c.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    'Estorno'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    'estorno'::text AS meio_pagamento,
    'estorno'::text AS natureza,
    CASE
        WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text
        WHEN cob.finalidade = 'fotos_extras'::text OR ct.descricao ~* '(foto[s]?\s+extra|\[extras)'::text THEN 'fotos_extras'::text
        WHEN cob.finalidade = 'sessao_e_extras'::text OR ct.descricao ~* '(sess[ãa]o\s*\+\s*extras|sessao_e_extras)'::text THEN 'sessao_e_extras'::text
        WHEN cob.descricao ~* '(sinal|entrada|arras|reserva)'::text OR ct.descricao ~* '(sinal|entrada|arras|reserva)'::text OR cob.finalidade = 'sinal'::text THEN 'sinal'::text
        WHEN cob.finalidade IS NOT NULL THEN cob.finalidade
        ELSE 'sessao'::text
    END AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
  WHERE ct.tipo = 'estorno'::text
UNION ALL
 SELECT ct.id::text || '_taxa'::text AS id,
    ct.data_transacao AS data,
    COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia,
    'saida'::text AS tipo,
    'Taxa Gateway / Antecipação'::text AS descricao,
        CASE
            WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text
            WHEN cob.galeria_id IS NOT NULL OR cob.finalidade = 'fotos_extras'::text THEN 'gallery'::text
            ELSE 'workflow'::text
        END AS origem,
    c.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    'Taxas de Gateway'::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    ct.valor - COALESCE(ct.valor_liquido, ct.valor) AS valor,
    'Pago'::text AS status,
    NULL::text AS cartao,
    NULL::text AS observacoes,
    ct.user_id,
    ct.session_id,
    ct.created_at,
    COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento,
    'taxa_gateway'::text AS natureza,
    NULL::text AS escopo
   FROM clientes_transacoes ct
     LEFT JOIN clientes c ON ct.cliente_id = c.id
     LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
     LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
  WHERE ct.tipo = 'pagamento'::text AND ct.valor_liquido IS NOT NULL AND ct.valor_liquido < ct.valor
UNION ALL
 SELECT ft.id::text AS id,
    ft.data_vencimento AS data,
    COALESCE(ft.data_competencia, ft.data_vencimento) AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(fim.nome, 'Item desconhecido'::text) AS descricao,
    'financeiro'::text AS origem,
    NULL::text AS cliente,
    NULL::text AS projeto,
    NULL::text AS categoria_session,
    fim.grupo_principal AS categoria,
    ft.parcela_atual,
    ft.parcela_total,
    ft.valor,
    ft.status,
    NULL::text AS cartao,
    ft.observacoes,
    ft.user_id,
    NULL::text AS session_id,
    ft.created_at,
    NULL::text AS meio_pagamento,
    'receita_fin'::text AS natureza,
    NULL::text AS escopo
   FROM fin_transactions ft
     JOIN fin_items_master fim ON ft.item_id = fim.id
  WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
 SELECT ft.id::text AS id,
    ft.data_vencimento AS data,
    COALESCE(ft.data_competencia, ft.data_vencimento) AS data_competencia,
    'saida'::text AS tipo,
    COALESCE(fim.nome, 'Item desconhecido'::text) AS descricao,
        CASE
            WHEN ft.credit_card_id IS NOT NULL THEN 'cartao'::text
            ELSE 'financeiro'::text
        END AS origem,
    NULL::text AS cliente,
    NULL::text AS projeto,
    NULL::text AS categoria_session,
    fim.grupo_principal AS categoria,
    ft.parcela_atual,
    ft.parcela_total,
    ft.valor,
    ft.status,
    fcc.nome AS cartao,
    ft.observacoes,
    ft.user_id,
    NULL::text AS session_id,
    ft.created_at,
    NULL::text AS meio_pagamento,
    'despesa'::text AS natureza,
    NULL::text AS escopo
   FROM fin_transactions ft
     JOIN fin_items_master fim ON ft.item_id = fim.id
     LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id
  WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional'::text, 'Receita Não Operacional'::text, 'Receita Extra'::text])
UNION ALL
 SELECT
    'cs_' || cs.id::text AS id,
    cs.data_sessao AS data,
    cs.data_sessao AS data_competencia,
    'entrada'::text AS tipo,
    COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
    CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'venda_avulsa'::text ELSE 'workflow'::text END AS origem,
    c.nome AS cliente,
    COALESCE(NULLIF(cs.pacote, ''), CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'Venda Avulsa' ELSE 'Sessão' END) AS projeto,
    cs.categoria AS categoria_session,
    NULL::text AS categoria,
    NULL::integer AS parcela_atual,
    NULL::integer AS parcela_total,
    (cs.valor_total - COALESCE(cs.valor_pago, 0)) AS valor,
    'Faturado'::text AS status,
    NULL::text AS cartao,
    cs.observacoes AS observacoes,
    cs.user_id,
    cs.session_id,
    cs.created_at,
    NULL::text AS meio_pagamento,
    'saldo_pendente'::text AS natureza,
    CASE WHEN cs.tipo_registro = 'venda_avulsa' THEN 'avulso'::text ELSE 'sessao'::text END AS escopo
  FROM clientes_sessoes cs
  LEFT JOIN clientes c ON cs.cliente_id = c.id
  WHERE cs.valor_total > COALESCE(cs.valor_pago, 0)
    AND (cs.status IS NULL OR cs.status <> 'cancelado');

GRANT SELECT ON public.extrato_unificado TO authenticated;
GRANT SELECT ON public.extrato_unificado TO anon;
