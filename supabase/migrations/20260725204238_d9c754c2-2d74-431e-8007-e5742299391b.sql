
-- =========================================================
-- workflow_range_metrics(user_id, start, end, granularity, include_historico)
-- Buckets por date_trunc; granularity ∈ day|month|quarter|year|total
-- =========================================================
CREATE OR REPLACE FUNCTION public.workflow_range_metrics(
  p_user_id uuid,
  p_start date,
  p_end date,
  p_granularity text DEFAULT 'month',
  p_include_historico boolean DEFAULT false
) RETURNS TABLE (
  bucket_key text,
  bucket_start date,
  previsto numeric,
  receita numeric,
  pendente numeric,
  sessoes integer,
  creditos_gerados numeric,
  creditos_utilizados numeric,
  caixa_recebido numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gran text := lower(coalesce(p_granularity, 'month'));
BEGIN
  IF p_end < p_start THEN
    RAISE EXCEPTION 'end date must be >= start date';
  END IF;
  IF (p_end - p_start) > 400 THEN
    RAISE EXCEPTION 'range too large: max 400 days';
  END IF;
  IF v_gran NOT IN ('day','month','quarter','year','total') THEN
    RAISE EXCEPTION 'invalid granularity: %', v_gran;
  END IF;

  RETURN QUERY
  WITH sess AS (
    SELECT id, session_id, data_sessao,
           COALESCE(valor_total,0) AS valor_total,
           COALESCE(valor_pago,0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro = 'workflow')
       AND (p_include_historico OR status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_bucketed AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(data_sessao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', data_sessao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', data_sessao), 'YYYY') || '-Q' || extract(quarter FROM data_sessao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', data_sessao), 'YYYY')
      END AS bkey,
      CASE
        WHEN v_gran = 'total' THEN p_start
        WHEN v_gran = 'day'   THEN data_sessao
        WHEN v_gran = 'month' THEN date_trunc('month', data_sessao)::date
        WHEN v_gran = 'quarter' THEN date_trunc('quarter', data_sessao)::date
        WHEN v_gran = 'year'  THEN date_trunc('year', data_sessao)::date
      END AS bstart,
      valor_total, valor_pago, id, session_id
    FROM sess
  ),
  sess_agg AS (
    SELECT
      bkey, bstart,
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess_bucketed
    GROUP BY bkey, bstart
  ),
  cred_ger AS (
    SELECT sb.bkey, COALESCE(SUM(l.valor), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess_bucketed sb
        ON sb.session_id = l.session_id_origem
        OR sb.id::text   = l.session_id_origem
     WHERE l.user_id = p_user_id
       AND l.valor > 0
     GROUP BY sb.bkey
  ),
  cred_uso AS (
    SELECT sb.bkey, COALESCE(SUM(ABS(l.valor)), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess_bucketed sb
        ON sb.session_id = l.session_id_consumo
        OR sb.id::text   = l.session_id_consumo
     WHERE l.user_id = p_user_id
     GROUP BY sb.bkey
  ),
  caixa_raw AS (
    SELECT
      CASE
        WHEN v_gran = 'total' THEN 'total'
        WHEN v_gran = 'day'   THEN to_char(t.data_transacao, 'YYYY-MM-DD')
        WHEN v_gran = 'month' THEN to_char(date_trunc('month', t.data_transacao), 'YYYY-MM')
        WHEN v_gran = 'quarter' THEN to_char(date_trunc('quarter', t.data_transacao), 'YYYY') || '-Q' || extract(quarter FROM t.data_transacao)::text
        WHEN v_gran = 'year'  THEN to_char(date_trunc('year', t.data_transacao), 'YYYY')
      END AS bkey,
      CASE t.tipo
        WHEN 'pagamento' THEN t.valor
        WHEN 'estorno'   THEN -t.valor
        ELSE 0
      END AS v
    FROM public.clientes_transacoes t
    WHERE t.user_id = p_user_id
      AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
      AND t.data_transacao BETWEEN p_start AND p_end
  ),
  caixa AS (
    SELECT bkey, COALESCE(SUM(v), 0) AS v FROM caixa_raw GROUP BY bkey
  )
  SELECT
    sa.bkey,
    sa.bstart,
    sa.previsto,
    sa.receita,
    sa.pendente,
    sa.sessoes,
    COALESCE(cg.v, 0),
    COALESCE(cu.v, 0),
    COALESCE(cx.v, 0)
  FROM sess_agg sa
  LEFT JOIN cred_ger cg ON cg.bkey = sa.bkey
  LEFT JOIN cred_uso cu ON cu.bkey = sa.bkey
  LEFT JOIN caixa    cx ON cx.bkey = sa.bkey
  ORDER BY sa.bstart;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_range_metrics(uuid,date,date,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_range_metrics(uuid,date,date,text,boolean) TO service_role;

-- =========================================================
-- workflow_analytics_summary(user_id, start, end, include_historico)
-- Retorna JSONB pronto para consumo do LLM.
-- =========================================================
CREATE OR REPLACE FUNCTION public.workflow_analytics_summary(
  p_user_id uuid,
  p_start date,
  p_end date,
  p_include_historico boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_end < p_start THEN
    RAISE EXCEPTION 'end date must be >= start date';
  END IF;
  IF (p_end - p_start) > 400 THEN
    RAISE EXCEPTION 'range too large: max 400 days';
  END IF;

  WITH sess AS (
    SELECT s.id, s.session_id, s.cliente_id, s.data_sessao,
           s.categoria, s.pacote, s.status,
           COALESCE(s.valor_total,0) AS valor_total,
           COALESCE(s.valor_pago,0)  AS valor_pago,
           c.nome AS cliente_nome
      FROM public.clientes_sessoes s
      LEFT JOIN public.clientes c ON c.id = s.cliente_id
     WHERE s.user_id = p_user_id
       AND (s.tipo_registro IS NULL OR s.tipo_registro = 'workflow')
       AND (p_include_historico OR s.status IS NULL OR s.status <> 'historico')
       AND s.data_sessao BETWEEN p_start AND p_end
  ),
  totals AS (
    SELECT
      COALESCE(SUM(valor_total),0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)),0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)),0)    AS pendente,
      COUNT(*)::int                                             AS sessoes,
      CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(valor_total),0)/COUNT(*) ELSE 0 END AS ticket_medio
    FROM sess
  ),
  por_mes AS (
    SELECT to_char(date_trunc('month', data_sessao),'YYYY-MM') AS mes,
           COALESCE(SUM(valor_total),0) AS previsto,
           COALESCE(SUM(LEAST(valor_pago, valor_total)),0) AS receita,
           COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)),0) AS pendente,
           COUNT(*)::int AS sessoes
    FROM sess GROUP BY 1 ORDER BY 1
  ),
  por_categoria AS (
    SELECT COALESCE(categoria,'(sem categoria)') AS categoria,
           COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_total),0) AS receita
    FROM sess GROUP BY 1 ORDER BY receita DESC
  ),
  por_pacote AS (
    SELECT COALESCE(pacote,'(sem pacote)') AS pacote,
           COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_total),0) AS receita
    FROM sess GROUP BY 1 ORDER BY receita DESC
  ),
  por_status AS (
    SELECT COALESCE(status,'(sem status)') AS status,
           COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_total),0) AS valor_total
    FROM sess GROUP BY 1 ORDER BY sessoes DESC
  ),
  top_clientes AS (
    SELECT cliente_id, cliente_nome,
           COUNT(*)::int AS sessoes,
           COALESCE(SUM(valor_total),0) AS receita
    FROM sess
    WHERE cliente_id IS NOT NULL
    GROUP BY cliente_id, cliente_nome
    ORDER BY receita DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('start', p_start, 'end', p_end, 'includeHistorico', p_include_historico),
    'totals', (SELECT to_jsonb(totals) FROM totals),
    'porMes', COALESCE((SELECT jsonb_agg(to_jsonb(por_mes)) FROM por_mes), '[]'::jsonb),
    'porCategoria', COALESCE((SELECT jsonb_agg(to_jsonb(por_categoria)) FROM por_categoria), '[]'::jsonb),
    'porPacote', COALESCE((SELECT jsonb_agg(to_jsonb(por_pacote)) FROM por_pacote), '[]'::jsonb),
    'porStatus', COALESCE((SELECT jsonb_agg(to_jsonb(por_status)) FROM por_status), '[]'::jsonb),
    'topClientes', COALESCE((SELECT jsonb_agg(to_jsonb(top_clientes)) FROM top_clientes), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.workflow_analytics_summary(uuid,date,date,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_analytics_summary(uuid,date,date,boolean) TO service_role;
