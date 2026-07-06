
CREATE OR REPLACE FUNCTION public.workflow_month_metrics(
  p_user_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  previsto numeric,
  receita numeric,
  pendente numeric,
  sessoes integer,
  creditos_gerados numeric,
  creditos_utilizados numeric,
  caixa_recebido numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sess AS (
    SELECT id, session_id,
           COALESCE(valor_total,0) AS valor_total,
           COALESCE(valor_pago,0)  AS valor_pago
      FROM public.clientes_sessoes
     WHERE user_id = p_user_id
       AND (tipo_registro IS NULL OR tipo_registro = 'workflow')
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
$$;
