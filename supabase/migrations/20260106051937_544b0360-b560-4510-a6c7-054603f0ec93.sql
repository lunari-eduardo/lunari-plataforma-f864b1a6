-- Primeiro excluir a transação vinculada
DELETE FROM clientes_transacoes WHERE id = 'a1f8cd04-f67f-4d50-bd37-00cc06dd5a88';

-- Depois excluir as duas sessões
DELETE FROM clientes_sessoes WHERE id IN (
  '4819eda9-fb66-4f9c-a4da-f151b57826ad',
  '8617a1d0-0f2c-4825-bc8c-f12d99d29a53'
);