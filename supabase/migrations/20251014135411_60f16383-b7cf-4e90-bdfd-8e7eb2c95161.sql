-- FASE 1: Tornar telefone opcional na tabela clientes
-- Permitir que clientes sejam criados apenas com nome

ALTER TABLE clientes 
ALTER COLUMN telefone DROP NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN clientes.telefone IS 'Telefone do cliente (opcional). Se fornecido, será validado no formato adequado.';