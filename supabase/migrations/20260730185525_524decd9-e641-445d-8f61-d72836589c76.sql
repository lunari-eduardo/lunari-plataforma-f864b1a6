
-- =========================================================
-- sales_analytics_summary — espelha o regime da página Análise de Vendas
-- (inclui venda avulsa e histórico; exclui apenas cancelado)
-- =========================================================
CREATE OR REPLACE FUNCTION public.sales_analytics_summary(
  p_user_id uuid,
  p_year integer,
  p_month integer DEFAULT NULL,
  p_categoria text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'invalid year: %', p_year;
  END IF;
  IF p_month IS NOT NULL AND (p_month < 1 OR p_month > 12) THEN
    RAISE EXCEPTION 'invalid month: %', p_month;
  END IF;

  WITH sess AS (
    SELECT
      s.id,
      s.data_sessao,
      COALESCE(s.categoria, '(sem categoria)')                       AS categoria,
      COALESCE(NULLIF(s.pacote, ''), '(sem pacote)')                 AS pacote,
      COALESCE(s.valor_total, 0)                                     AS valor_total,
      COALESCE(s.valor_pago, 0)                                      AS valor_pago,
      COALESCE(s.desconto, 0)                                        AS desconto,
      COALESCE(s.valor_total_foto_extra, 0)                          AS valor_foto_extra,
      COALESCE(s.valor_adicional, 0)                                 AS valor_adicional,
      CASE
        WHEN s.tipo_registro = 'venda_avulsa' THEN 'venda-avulsa'
        ELSE COALESCE(NULLIF(c.origem, ''), 'nao-especificado')
      END                                                            AS origem,
      COALESCE(NULLIF(c.email, ''), NULLIF(c.telefone, ''), NULLIF(c.whatsapp, ''), s.cliente_id::text) AS cliente_key
    FROM public.clientes_sessoes s
    LEFT JOIN public.clientes c ON c.id = s.cliente_id
    WHERE s.user_id = p_user_id
      AND (s.status IS NULL OR s.status <> 'cancelado')
      AND s.data_sessao IS NOT NULL
      AND EXTRACT(YEAR FROM s.data_sessao)::int = p_year
      AND (p_month IS NULL OR EXTRACT(MONTH FROM s.data_sessao)::int = p_month)
      AND (p_categoria IS NULL OR lower(COALESCE(s.categoria, '')) = lower(p_categoria))
  ),
  totals AS (
    SELECT
      COALESCE(SUM(valor_pago), 0)                                      AS receita_realizada,
      COALESCE(SUM(valor_total), 0)                                     AS receita_prevista,
      GREATEST(COALESCE(SUM(valor_total), 0) - COALESCE(SUM(valor_pago), 0), 0) AS pendente,
      COUNT(*)::int                                                     AS sessoes,
      CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(valor_pago), 0) / COUNT(*) ELSE 0 END AS ticket_medio,
      COALESCE(SUM(desconto), 0)                                        AS desconto_total,
      COALESCE(SUM(valor_foto_extra), 0)                                AS receita_fotos_extras,
      COALESCE(SUM(valor_adicional), 0)                                 AS receita_adicional,
      COUNT(DISTINCT cliente_key)                                       AS clientes_unicos
    FROM sess
  ),
  por_mes AS (
    SELECT
      EXTRACT(MONTH FROM data_sessao)::int AS mes,
      to_char(date_trunc('month', data_sessao), 'YYYY-MM') AS competencia,
      COALESCE(SUM(valor_pago), 0)   AS receita,
      COALESCE(SUM(valor_total), 0)  AS previsto,
      COALESCE(SUM(valor_foto_extra), 0) AS fotos_extras,
      COUNT(*)::int AS sessoes,
      CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(valor_pago), 0) / COUNT(*) ELSE 0 END AS ticket_medio
    FROM sess GROUP BY 1, 2 ORDER BY 1
  ),
  por_categoria AS (
    SELECT categoria, COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_pago), 0) AS receita,
           COALESCE(SUM(valor_total), 0) AS previsto
    FROM sess GROUP BY 1 ORDER BY 3 DESC
  ),
  por_pacote AS (
    SELECT pacote, COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_pago), 0) AS receita
    FROM sess GROUP BY 1 ORDER BY 3 DESC
  ),
  por_origem AS (
    SELECT origem, COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_pago), 0) AS receita
    FROM sess GROUP BY 1 ORDER BY 3 DESC
  ),
  anos AS (
    SELECT DISTINCT EXTRACT(YEAR FROM data_sessao)::int AS ano
    FROM public.clientes_sessoes
    WHERE user_id = p_user_id AND data_sessao IS NOT NULL
      AND (status IS NULL OR status <> 'cancelado')
    ORDER BY 1 DESC
  ),
  cats AS (
    SELECT DISTINCT categoria FROM (
      SELECT COALESCE(categoria, '(sem categoria)') AS categoria
      FROM public.clientes_sessoes
      WHERE user_id = p_user_id AND (status IS NULL OR status <> 'cancelado')
    ) x ORDER BY 1
  )
  SELECT jsonb_build_object(
    'filtros', jsonb_build_object('ano', p_year, 'mes', p_month, 'categoria', p_categoria),
    'totais', (SELECT to_jsonb(t) FROM totals t),
    'porMes', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM por_mes m), '[]'::jsonb),
    'porCategoria', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM por_categoria c), '[]'::jsonb),
    'porPacote', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM por_pacote p), '[]'::jsonb),
    'porOrigem', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM por_origem o), '[]'::jsonb),
    'anosDisponiveis', COALESCE((SELECT jsonb_agg(ano) FROM anos), '[]'::jsonb),
    'categoriasDisponiveis', COALESCE((SELECT jsonb_agg(categoria) FROM cats), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sales_analytics_summary(uuid,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_analytics_summary(uuid,integer,integer,text) TO service_role;

-- =========================================================
-- sales_analytics_compare — ano base x ano de comparação (período equivalente)
-- =========================================================
CREATE OR REPLACE FUNCTION public.sales_analytics_compare(
  p_user_id uuid,
  p_ano_base integer,
  p_ano_comparacao integer,
  p_limite_mes integer DEFAULT NULL,
  p_categoria text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limite int;
  v_result jsonb;
BEGIN
  IF p_ano_base IS NULL OR p_ano_comparacao IS NULL THEN
    RAISE EXCEPTION 'anos obrigatórios';
  END IF;

  v_limite := COALESCE(
    p_limite_mes,
    CASE WHEN p_ano_base = EXTRACT(YEAR FROM now())::int
         THEN GREATEST(EXTRACT(MONTH FROM now())::int - 1, 1)
         ELSE 12 END
  );
  IF v_limite < 1 THEN v_limite := 1; END IF;
  IF v_limite > 12 THEN v_limite := 12; END IF;

  WITH sess AS (
    SELECT
      EXTRACT(YEAR FROM s.data_sessao)::int  AS ano,
      EXTRACT(MONTH FROM s.data_sessao)::int AS mes,
      COALESCE(s.valor_total, 0) AS valor_total,
      COALESCE(s.valor_pago, 0)  AS valor_pago,
      COALESCE(s.valor_total_foto_extra, 0) AS valor_foto_extra
    FROM public.clientes_sessoes s
    WHERE s.user_id = p_user_id
      AND (s.status IS NULL OR s.status <> 'cancelado')
      AND s.data_sessao IS NOT NULL
      AND EXTRACT(YEAR FROM s.data_sessao)::int IN (p_ano_base, p_ano_comparacao)
      AND EXTRACT(MONTH FROM s.data_sessao)::int <= v_limite
      AND (p_categoria IS NULL OR lower(COALESCE(s.categoria, '')) = lower(p_categoria))
  ),
  agg AS (
    SELECT ano,
           COALESCE(SUM(valor_pago), 0)  AS receita,
           COALESCE(SUM(valor_total), 0) AS previsto,
           COALESCE(SUM(valor_foto_extra), 0) AS fotos_extras,
           COUNT(*)::int AS sessoes,
           CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(valor_pago), 0) / COUNT(*) ELSE 0 END AS ticket_medio
    FROM sess GROUP BY ano
  ),
  b AS (SELECT * FROM agg WHERE ano = p_ano_base),
  c AS (SELECT * FROM agg WHERE ano = p_ano_comparacao),
  mensal AS (
    SELECT m.mes,
           COALESCE(SUM(CASE WHEN s.ano = p_ano_base THEN s.valor_pago END), 0) AS receita_base,
           COALESCE(SUM(CASE WHEN s.ano = p_ano_comparacao THEN s.valor_pago END), 0) AS receita_comparacao,
           COALESCE(SUM(CASE WHEN s.ano = p_ano_base THEN 1 END), 0)::int AS sessoes_base,
           COALESCE(SUM(CASE WHEN s.ano = p_ano_comparacao THEN 1 END), 0)::int AS sessoes_comparacao
    FROM generate_series(1, v_limite) AS m(mes)
    LEFT JOIN sess s ON s.mes = m.mes
    GROUP BY m.mes ORDER BY m.mes
  )
  SELECT jsonb_build_object(
    'anoBase', p_ano_base,
    'anoComparacao', p_ano_comparacao,
    'limiteMes', v_limite,
    'categoria', p_categoria,
    'base', COALESCE((SELECT to_jsonb(b) FROM b), '{}'::jsonb),
    'comparacao', COALESCE((SELECT to_jsonb(c) FROM c), '{}'::jsonb),
    'variacaoPercentual', jsonb_build_object(
      'receita', CASE WHEN COALESCE((SELECT receita FROM c), 0) > 0
                      THEN round(((COALESCE((SELECT receita FROM b), 0) - (SELECT receita FROM c)) / (SELECT receita FROM c) * 100)::numeric, 2)
                      ELSE NULL END,
      'sessoes', CASE WHEN COALESCE((SELECT sessoes FROM c), 0) > 0
                      THEN round(((COALESCE((SELECT sessoes FROM b), 0) - (SELECT sessoes FROM c))::numeric / (SELECT sessoes FROM c) * 100), 2)
                      ELSE NULL END,
      'ticketMedio', CASE WHEN COALESCE((SELECT ticket_medio FROM c), 0) > 0
                      THEN round(((COALESCE((SELECT ticket_medio FROM b), 0) - (SELECT ticket_medio FROM c)) / (SELECT ticket_medio FROM c) * 100)::numeric, 2)
                      ELSE NULL END,
      'fotosExtras', CASE WHEN COALESCE((SELECT fotos_extras FROM c), 0) > 0
                      THEN round(((COALESCE((SELECT fotos_extras FROM b), 0) - (SELECT fotos_extras FROM c)) / (SELECT fotos_extras FROM c) * 100)::numeric, 2)
                      ELSE NULL END
    ),
    'porMes', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM mensal x), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sales_analytics_compare(uuid,integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_analytics_compare(uuid,integer,integer,integer,text) TO service_role;

-- =========================================================
-- Amplia a janela máxima dos relatórios de workflow (400 → 1200 dias)
-- =========================================================
DO $$
DECLARE
  v_def text;
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('workflow_range_metrics', 'workflow_analytics_summary')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, '> 400 THEN', '> 1200 THEN');
    v_def := replace(v_def, 'max 400 days', 'max 1200 days');
    EXECUTE v_def;
  END LOOP;
END;
$$;
