-- Índice de suporte para JOIN pacotes por (user_id, nome)
CREATE INDEX IF NOT EXISTS idx_pacotes_user_nome
  ON public.pacotes (user_id, nome);

-- RPC: produção fotográfica do mês
CREATE OR REPLACE FUNCTION public.workflow_photo_production_month(
  p_user_id uuid,
  p_start   date,
  p_end     date,
  p_categoria text DEFAULT NULL
)
RETURNS TABLE (
  fotos_incluidas         integer,
  fotos_extras            integer,
  fotos_total             integer,
  sessoes_com_pacote      integer,
  sessoes_sem_pacote      integer,
  media_fotos_por_sessao  numeric,
  categoria_top           text,
  fotos_categoria_top     integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      s.id,
      s.categoria,
      COALESCE(
        NULLIF((s.regras_congeladas -> 'pacote' ->> 'fotosIncluidas')::int, 0),
        p.fotos_incluidas,
        0
      )::int AS fotos_incluidas,
      (CASE
        WHEN s.extras_overridden THEN COALESCE(s.qtd_fotos_extra, 0)
        WHEN g.id IS NOT NULL     THEN COALESCE(g.total_fotos_extras_vendidas, s.qtd_fotos_extra, 0)
        ELSE COALESCE(s.qtd_fotos_extra, 0)
      END)::int AS fotos_extras
    FROM public.clientes_sessoes s
    LEFT JOIN public.pacotes  p ON p.user_id = s.user_id AND p.nome = s.pacote
    LEFT JOIN public.galerias g ON g.id = s.galeria_id
    WHERE s.user_id = p_user_id
      AND s.data_sessao BETWEEN p_start AND p_end
      AND s.tipo_registro = 'workflow'
      AND (s.status IS NULL OR s.status <> 'historico')
      AND (p_categoria IS NULL OR s.categoria = p_categoria)
  ),
  per_cat AS (
    SELECT categoria, SUM(fotos_incluidas + fotos_extras)::int AS total
    FROM base
    GROUP BY categoria
    ORDER BY total DESC NULLS LAST
    LIMIT 1
  )
  SELECT
    COALESCE(SUM(b.fotos_incluidas), 0)::int              AS fotos_incluidas,
    COALESCE(SUM(b.fotos_extras), 0)::int                 AS fotos_extras,
    COALESCE(SUM(b.fotos_incluidas + b.fotos_extras), 0)::int AS fotos_total,
    COALESCE(SUM((b.fotos_incluidas > 0)::int), 0)::int   AS sessoes_com_pacote,
    COALESCE(SUM((b.fotos_incluidas = 0)::int), 0)::int   AS sessoes_sem_pacote,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(AVG(b.fotos_incluidas + b.fotos_extras)::numeric, 2)
         ELSE 0
    END                                                    AS media_fotos_por_sessao,
    (SELECT categoria FROM per_cat)                        AS categoria_top,
    COALESCE((SELECT total FROM per_cat), 0)::int          AS fotos_categoria_top
  FROM base b;
$$;

GRANT EXECUTE ON FUNCTION public.workflow_photo_production_month(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_photo_production_month(uuid, date, date, text) TO service_role;