DROP FUNCTION IF EXISTS public.admin_egress_table_stats();

CREATE OR REPLACE FUNCTION public.admin_egress_table_stats(_user_id uuid)
RETURNS TABLE(
  table_name text, rows_read bigint, rows_inserted bigint, rows_updated bigint,
  rows_deleted bigint, live_rows bigint, total_size_bytes bigint, total_size_pretty text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF _user_id IS NULL OR NOT public.has_role(_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT
    s.relname::text,
    COALESCE(s.seq_tup_read,0) + COALESCE(s.idx_tup_fetch,0),
    COALESCE(s.n_tup_ins,0),
    COALESCE(s.n_tup_upd,0),
    COALESCE(s.n_tup_del,0),
    COALESCE(s.n_live_tup,0),
    pg_total_relation_size(c.oid),
    pg_size_pretty(pg_total_relation_size(c.oid))
  FROM pg_stat_user_tables s
  JOIN pg_class c ON c.oid = s.relid
  WHERE s.schemaname = 'public'
  ORDER BY (COALESCE(s.seq_tup_read,0) + COALESCE(s.idx_tup_fetch,0)) DESC
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_egress_table_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_egress_table_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_egress_table_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_egress_table_stats(uuid) TO service_role;