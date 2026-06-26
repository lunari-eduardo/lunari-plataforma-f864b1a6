-- Função para o dashboard admin de egress.
-- Retorna proxies de "dados que saem" por tabela: rows lidas, rows escritas, tamanho em disco.
CREATE OR REPLACE FUNCTION public.admin_egress_table_stats()
RETURNS TABLE(
  table_name text,
  rows_read bigint,
  rows_inserted bigint,
  rows_updated bigint,
  rows_deleted bigint,
  live_rows bigint,
  total_size_bytes bigint,
  total_size_pretty text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Somente admins
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT
    s.relname::text AS table_name,
    COALESCE(s.seq_tup_read, 0) + COALESCE(s.idx_tup_fetch, 0) AS rows_read,
    COALESCE(s.n_tup_ins, 0) AS rows_inserted,
    COALESCE(s.n_tup_upd, 0) AS rows_updated,
    COALESCE(s.n_tup_del, 0) AS rows_deleted,
    COALESCE(s.n_live_tup, 0) AS live_rows,
    pg_total_relation_size(c.oid) AS total_size_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size_pretty
  FROM pg_stat_user_tables s
  JOIN pg_class c ON c.oid = s.relid
  WHERE s.schemaname = 'public'
  ORDER BY (COALESCE(s.seq_tup_read, 0) + COALESCE(s.idx_tup_fetch, 0)) DESC
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_egress_table_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_egress_table_stats() TO authenticated, service_role;