-- 1) Normalizar vendas avulsas existentes: sem etapa e sem categoria inventada
UPDATE public.clientes_sessoes
   SET status = NULL
 WHERE tipo_registro = 'venda_avulsa'
   AND status IS NOT NULL
   AND status <> 'historico'
   AND NOT EXISTS (
     SELECT 1 FROM public.etapas_trabalho e
      WHERE e.user_id = clientes_sessoes.user_id
        AND e.nome = clientes_sessoes.status
   );

UPDATE public.clientes_sessoes
   SET categoria = ''
 WHERE tipo_registro = 'venda_avulsa'
   AND categoria = 'Venda Avulsa'
   AND (pacote IS NULL OR pacote = '');

-- 2) Métricas do Workflow passam a incluir vendas avulsas
CREATE OR REPLACE FUNCTION public.workflow_month_metrics(p_user_id uuid, p_start date, p_end date)
 RETURNS TABLE(previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sess AS (
    SELECT id, session_id,
           COALESCE(valor_total,0) AS valor_total,
           COALESCE(valor_pago,0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow','venda_avulsa'))
       AND (status IS NULL OR status <> 'historico')
       AND data_sessao BETWEEN p_start AND p_end
  ),
  sess_agg AS (
    SELECT
      COALESCE(SUM(valor_total), 0)                              AS previsto,
      COALESCE(SUM(LEAST(valor_pago, valor_total)), 0)           AS receita,
      COALESCE(SUM(GREATEST(valor_total - valor_pago, 0)), 0)    AS pendente,
      COUNT(*)::int                                              AS sessoes
    FROM sess
  ),
  cred_ger AS (
    SELECT COALESCE(SUM(l.valor), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess s
        ON s.session_id = l.session_id_origem
        OR s.id::text   = l.session_id_origem
     WHERE l.user_id = p_user_id
       AND l.valor > 0
  ),
  cred_uso AS (
    SELECT COALESCE(SUM(ABS(l.valor)), 0) AS v
      FROM public.cliente_creditos_ledger l
      JOIN sess s
        ON s.session_id = l.session_id_consumo
        OR s.id::text   = l.session_id_consumo
     WHERE l.user_id = p_user_id
  ),
  caixa AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN t.tipo = 'pagamento' THEN t.valor
        WHEN t.tipo = 'estorno'   THEN -t.valor
        ELSE 0
      END
    ), 0) AS v
      FROM public.clientes_transacoes t
     WHERE t.user_id = p_user_id
       AND (t.descricao IS NULL OR t.descricao NOT LIKE '[CREDIT:%')
       AND t.data_transacao BETWEEN p_start AND p_end
  )
  SELECT sa.previsto, sa.receita, sa.pendente, sa.sessoes,
         cg.v, cu.v, cx.v
    FROM sess_agg sa, cred_ger cg, cred_uso cu, caixa cx;
$function$;

CREATE OR REPLACE FUNCTION public.workflow_range_metrics(p_user_id uuid, p_start date, p_end date, p_granularity text DEFAULT 'month'::text, p_include_historico boolean DEFAULT false)
 RETURNS TABLE(bucket_key text, bucket_start date, previsto numeric, receita numeric, pendente numeric, sessoes integer, creditos_gerados numeric, creditos_utilizados numeric, caixa_recebido numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
       AND (tipo_registro IS NULL OR tipo_registro IN ('workflow','venda_avulsa'))
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