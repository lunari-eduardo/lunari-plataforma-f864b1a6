-- 1. View: Faturamento por Cidade
CREATE OR REPLACE VIEW public.faturamento_por_cidade AS
SELECT 
  p.cidade_nome as cidade,
  p.cidade_uf as estado,
  COALESCE(SUM(ct.valor), 0) as faturamento_total,
  COUNT(DISTINCT p.user_id) as total_fotografos,
  CASE 
    WHEN COUNT(DISTINCT p.user_id) > 0 
    THEN ROUND(COALESCE(SUM(ct.valor), 0) / COUNT(DISTINCT p.user_id), 2)
    ELSE 0 
  END as ticket_medio,
  DATE_TRUNC('month', ct.data_transacao)::date as mes
FROM public.profiles p
LEFT JOIN public.clientes_transacoes ct ON ct.user_id = p.user_id AND ct.tipo = 'pagamento'
WHERE p.cidade_nome IS NOT NULL
GROUP BY p.cidade_nome, p.cidade_uf, DATE_TRUNC('month', ct.data_transacao);

-- 2. View: Faturamento por Nicho
CREATE OR REPLACE VIEW public.faturamento_por_nicho AS
SELECT 
  p.nicho,
  COALESCE(SUM(ct.valor), 0) as faturamento_total,
  COUNT(DISTINCT p.user_id) as total_usuarios,
  CASE 
    WHEN COUNT(DISTINCT p.user_id) > 0 
    THEN ROUND(COALESCE(SUM(ct.valor), 0) / COUNT(DISTINCT p.user_id), 2)
    ELSE 0 
  END as ticket_medio,
  DATE_TRUNC('month', ct.data_transacao)::date as mes
FROM public.profiles p
LEFT JOIN public.clientes_transacoes ct ON ct.user_id = p.user_id AND ct.tipo = 'pagamento'
WHERE p.nicho IS NOT NULL
GROUP BY p.nicho, DATE_TRUNC('month', ct.data_transacao);

-- 3. View: Cruzamento Cidade x Nicho
CREATE OR REPLACE VIEW public.faturamento_por_cidade_nicho AS
SELECT 
  p.cidade_nome as cidade,
  p.cidade_uf as estado,
  p.nicho,
  COALESCE(SUM(ct.valor), 0) as faturamento_total,
  COUNT(DISTINCT p.user_id) as total_usuarios,
  DATE_TRUNC('month', ct.data_transacao)::date as mes
FROM public.profiles p
LEFT JOIN public.clientes_transacoes ct ON ct.user_id = p.user_id AND ct.tipo = 'pagamento'
WHERE p.cidade_nome IS NOT NULL AND p.nicho IS NOT NULL
GROUP BY p.cidade_nome, p.cidade_uf, p.nicho, DATE_TRUNC('month', ct.data_transacao);

-- 4. View: Crescimento Mensal
CREATE OR REPLACE VIEW public.crescimento_mensal AS
SELECT 
  DATE_TRUNC('month', ct.data_transacao)::date as mes,
  SUM(ct.valor) as faturamento,
  COUNT(DISTINCT ct.user_id) as fotografos_ativos,
  COUNT(*) as total_transacoes
FROM public.clientes_transacoes ct
WHERE ct.tipo = 'pagamento'
GROUP BY DATE_TRUNC('month', ct.data_transacao)
ORDER BY mes DESC;

-- Grant SELECT on views to authenticated users (admin will filter via RLS on base tables)
GRANT SELECT ON public.faturamento_por_cidade TO authenticated;
GRANT SELECT ON public.faturamento_por_nicho TO authenticated;
GRANT SELECT ON public.faturamento_por_cidade_nicho TO authenticated;
GRANT SELECT ON public.crescimento_mensal TO authenticated;