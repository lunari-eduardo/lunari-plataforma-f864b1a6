-- Adicionar índices para otimizar queries de workflow e tempo real

-- Índice composto para queries por usuário + data (usado em loadSessions)
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_user_data 
ON clientes_sessoes(user_id, data_sessao DESC)
WHERE status != 'historico';

-- Índice para busca rápida por session_id (usado em atualizações e pagamentos)
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_session 
ON clientes_sessoes(session_id)
WHERE status != 'historico';

-- Índice para busca por appointment_id (sincronização agenda-workflow)
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_appointment 
ON clientes_sessoes(appointment_id)
WHERE appointment_id IS NOT NULL;

-- Índice para appointments - queries de sincronização
CREATE INDEX IF NOT EXISTS idx_appointments_user_status_date 
ON appointments(user_id, status, date DESC);

-- Índice para busca de appointments por session_id
CREATE INDEX IF NOT EXISTS idx_appointments_session 
ON appointments(session_id)
WHERE session_id IS NOT NULL;

-- Índice para transações por session_id (usado para calcular valores pagos)
CREATE INDEX IF NOT EXISTS idx_transacoes_session_tipo 
ON clientes_transacoes(session_id, tipo)
WHERE session_id IS NOT NULL;

-- Índice para transações por usuário e data (relatórios financeiros)
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data 
ON clientes_transacoes(user_id, data_transacao DESC);

-- Atualizar estatísticas para otimizar query planner
ANALYZE clientes_sessoes;
ANALYZE appointments;
ANALYZE clientes_transacoes;