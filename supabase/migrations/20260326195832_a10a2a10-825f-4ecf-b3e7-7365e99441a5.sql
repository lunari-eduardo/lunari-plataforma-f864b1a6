
-- 1. Add cobranca_id column to clientes_transacoes
ALTER TABLE public.clientes_transacoes 
ADD COLUMN cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL;

-- 2. Backfill cobranca_id from description - only where cobranca actually exists
UPDATE public.clientes_transacoes ct
SET cobranca_id = cob.id
FROM public.cobrancas cob
WHERE ct.descricao ILIKE '%cobranca ' || cob.id::text || '%'
  AND ct.cobranca_id IS NULL
  AND ct.tipo = 'pagamento';

-- 3. Create index for performance
CREATE INDEX idx_clientes_transacoes_cobranca_id ON public.clientes_transacoes(cobranca_id) WHERE cobranca_id IS NOT NULL;

-- 4. Update ensure_transaction_on_cobranca_paid to populate cobranca_id
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
  v_session_exists BOOLEAN;
  v_provedor_label TEXT;
BEGIN
  IF NEW.status IN ('pago', 'pago_manual') AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'pago_manual')) THEN
    
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
    
    v_session_exists := (v_session_text IS NOT NULL);
    
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
    
    IF NOT v_session_exists THEN
      v_session_text := NEW.session_id;
    END IF;
    
    -- Primary check: by cobranca_id
    SELECT id INTO v_existing_tx
    FROM public.clientes_transacoes
    WHERE cobranca_id = NEW.id
    LIMIT 1;
    
    -- Fallback: by cobranca UUID in description
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
    
    -- Secondary check: same session + same valor + same provider
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
        user_id, cliente_id, session_id, valor, valor_liquido, taxa_gateway, taxa_antecipacao, tipo, data_transacao, descricao, cobranca_id
      ) VALUES (
        NEW.user_id,
        v_cliente_id,
        v_session_text,
        v_valor_transacao,
        v_valor_liquido,
        v_taxa_gateway,
        v_taxa_antecipacao,
        'pagamento',
        COALESCE(NEW.data_pagamento::date, CURRENT_DATE),
        FORMAT('Pagamento %s - cobranca %s%s [auto-reconciled]',
          v_provedor_label,
          NEW.id,
          CASE WHEN NEW.descricao IS NOT NULL THEN ' - ' || NEW.descricao ELSE '' END
        ),
        NEW.id
      );
    ELSE
      UPDATE public.clientes_transacoes
      SET valor_liquido = v_valor_liquido,
          taxa_gateway = v_taxa_gateway,
          taxa_antecipacao = v_taxa_antecipacao,
          cobranca_id = COALESCE(cobranca_id, NEW.id)
      WHERE id = v_existing_tx
        AND (valor_liquido IS NULL OR valor_liquido = 0);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Recreate extrato_unificado view using cobranca_id
DROP VIEW IF EXISTS public.extrato_unificado;

CREATE VIEW public.extrato_unificado WITH (security_invoker=on) AS
SELECT 
  ct.id::text AS id,
  ct.data_transacao AS data,
  'entrada'::text AS tipo,
  COALESCE(c.nome, 'Cliente desconhecido'::text) AS descricao,
  CASE WHEN cob.galeria_id IS NOT NULL THEN 'gallery'::text ELSE 'workflow'::text END AS origem,
  c.nome AS cliente,
  cs.pacote AS projeto,
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
  COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'

UNION ALL

SELECT 
  ft.id::text AS id,
  ft.data_vencimento AS data,
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
  NULL::text AS meio_pagamento
FROM fin_transactions ft
JOIN fin_items_master fim ON ft.item_id = fim.id
WHERE fim.grupo_principal = ANY (ARRAY['Receita Operacional','Receita Não Operacional','Receita Extra'])

UNION ALL

SELECT 
  ft.id::text AS id,
  ft.data_vencimento AS data,
  'saida'::text AS tipo,
  COALESCE(fim.nome, 'Item desconhecido'::text) AS descricao,
  CASE WHEN ft.credit_card_id IS NOT NULL THEN 'cartao'::text ELSE 'financeiro'::text END AS origem,
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
  NULL::text AS meio_pagamento
FROM fin_transactions ft
JOIN fin_items_master fim ON ft.item_id = fim.id
LEFT JOIN fin_credit_cards fcc ON ft.credit_card_id = fcc.id
WHERE fim.grupo_principal <> ALL (ARRAY['Receita Operacional','Receita Não Operacional','Receita Extra'])

UNION ALL

SELECT 
  ct.id::text || '_taxa' AS id,
  ct.data_transacao AS data,
  'saida'::text AS tipo,
  'Taxa Gateway / Antecipação'::text AS descricao,
  CASE WHEN cob.galeria_id IS NOT NULL THEN 'gallery'::text ELSE 'workflow'::text END AS origem,
  c.nome AS cliente,
  cs.pacote AS projeto,
  cs.categoria AS categoria_session,
  'Taxas de Gateway'::text AS categoria,
  NULL::integer AS parcela_atual,
  NULL::integer AS parcela_total,
  COALESCE(ct.taxa_gateway, 0) + COALESCE(ct.taxa_antecipacao, 0) AS valor,
  'Pago'::text AS status,
  NULL::text AS cartao,
  NULL::text AS observacoes,
  ct.user_id,
  ct.session_id,
  ct.created_at,
  COALESCE(cob.provedor, 'manual'::text) AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id
WHERE ct.tipo = 'pagamento'
  AND (COALESCE(ct.taxa_gateway, 0) + COALESCE(ct.taxa_antecipacao, 0)) > 0;
