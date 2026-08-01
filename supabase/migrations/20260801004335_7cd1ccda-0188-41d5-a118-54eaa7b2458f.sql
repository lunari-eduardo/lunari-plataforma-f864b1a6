DELETE FROM public.clientes_transacoes
WHERE id IN ('59792d6a-3d75-4efa-92fd-5f337f7a149f','771e58c0-c989-407f-8e4f-54f943788bc4')
  AND user_id = 'db0ca3d8-8848-4194-aa74-40d265b73849';

DELETE FROM public.cobranca_parcelas
WHERE cobranca_id IN ('55f54388-8ca8-4950-89fa-668fb341d125','9ea72b5b-97c0-46ea-b793-15643982a6f3');

DELETE FROM public.cobrancas
WHERE id IN ('55f54388-8ca8-4950-89fa-668fb341d125','9ea72b5b-97c0-46ea-b793-15643982a6f3');