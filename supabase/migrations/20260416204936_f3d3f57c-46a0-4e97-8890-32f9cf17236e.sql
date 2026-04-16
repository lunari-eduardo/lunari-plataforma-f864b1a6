UPDATE public.appointments a
SET cliente_id = c.id
FROM public.clientes c
WHERE a.cliente_id IS NULL
  AND a.user_id = c.user_id
  AND lower(trim(a.title)) = lower(trim(c.nome));