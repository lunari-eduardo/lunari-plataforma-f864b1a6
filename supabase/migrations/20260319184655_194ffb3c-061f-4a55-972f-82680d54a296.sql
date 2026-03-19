
-- Fix all sessions where valor_pago is out of sync with actual transactions
-- This corrects the bug caused by duplicate transaction creation in the webhook
-- that was later partially cleaned up without re-triggering recompute

DO $$
DECLARE
  r RECORD;
  fixed_count INT := 0;
BEGIN
  FOR r IN
    WITH expected AS (
      SELECT session_id, COALESCE(SUM(valor), 0) AS soma
      FROM clientes_transacoes
      WHERE tipo = 'pagamento' AND session_id IS NOT NULL
      GROUP BY session_id
    )
    SELECT cs.session_id, cs.valor_pago AS atual, e.soma AS esperado
    FROM clientes_sessoes cs
    JOIN expected e ON cs.session_id = e.session_id
    WHERE cs.valor_pago != e.soma
  LOOP
    PERFORM public.recompute_session_paid(r.session_id);
    fixed_count := fixed_count + 1;
    RAISE NOTICE 'Fixed session % : % -> %', r.session_id, r.atual, r.esperado;
  END LOOP;
  
  RAISE NOTICE 'Total sessions fixed: %', fixed_count;
END $$;
