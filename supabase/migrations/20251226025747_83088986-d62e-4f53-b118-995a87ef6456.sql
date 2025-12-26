-- Remover transações vinculadas a sessões importadas
DELETE FROM clientes_transacoes WHERE session_id LIKE 'import_%';

-- Agora remover sessões importadas
DELETE FROM clientes_sessoes WHERE session_id LIKE 'import_%';