UPDATE public.clientes_sessoes
SET categoria = ''
WHERE tipo_registro = 'venda_avulsa'
  AND lower(coalesce(categoria, '')) IN ('venda avulsa', 'venda_avulsa');

UPDATE public.clientes_sessoes
SET status = NULL
WHERE tipo_registro = 'venda_avulsa'
  AND coalesce(status, '') = 'agendado'
  AND coalesce(pacote, '') = '';