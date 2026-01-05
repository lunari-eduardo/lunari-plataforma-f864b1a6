-- =====================================================
-- FASE 1.1: LIMPEZA DE TRIGGERS DUPLICADOS
-- =====================================================

-- APPOINTMENTS: Remover duplicados

-- Manter apenas: appointments_enforce_type_category
DROP TRIGGER IF EXISTS trigger_enforce_appointment_type ON appointments;

-- Manter apenas: cleanup_occupied_slots
DROP TRIGGER IF EXISTS trigger_cleanup_availability ON appointments;

-- Manter apenas: sync_appointment_data (mais genérico)
DROP TRIGGER IF EXISTS sync_appointment_date_to_session ON appointments;


-- CLIENTES_SESSOES: Remover duplicados

-- Manter apenas: recalc_fotos_extras (BEFORE - primeiro)
DROP TRIGGER IF EXISTS trigger_recalculate_fotos_extras ON clientes_sessoes;
DROP TRIGGER IF EXISTS trigger_recalculate_fotos_extras_total ON clientes_sessoes;

-- Manter apenas: clientes_sessoes_fix_inversion (BEFORE - mais seguro)
DROP TRIGGER IF EXISTS trigger_fix_session_inversion ON clientes_sessoes;

-- Manter apenas: trigger_update_clientes_sessoes_updated_at
DROP TRIGGER IF EXISTS update_clientes_sessoes_updated_at ON clientes_sessoes;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON clientes_sessoes;

-- Manter apenas: trigger_validate_regras_congeladas
DROP TRIGGER IF EXISTS validate_frozen_rules ON clientes_sessoes;


-- CLIENTES_TRANSACOES: Remover duplicados (manter apenas recompute_paid_amount)
DROP TRIGGER IF EXISTS recompute_session_paid_trigger ON clientes_transacoes;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_insert ON clientes_transacoes;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_on_transaction ON clientes_transacoes;


-- =====================================================
-- FASE 1.2: CRIAR ÍNDICES COMPOSTOS OTIMIZADOS
-- =====================================================

-- Índice para queries de workflow (user_id + status + data)
CREATE INDEX IF NOT EXISTS idx_sessoes_user_status_data 
ON clientes_sessoes(user_id, status, data_sessao DESC);

-- Índice para appointments por user + date (frequente na agenda)
CREATE INDEX IF NOT EXISTS idx_appointments_user_date 
ON appointments(user_id, date DESC);

-- Índice para appointments por user + status
CREATE INDEX IF NOT EXISTS idx_appointments_user_status 
ON appointments(user_id, status);

-- Índice para transações financeiras por user + mês
CREATE INDEX IF NOT EXISTS idx_fin_transactions_user_date 
ON fin_transactions(user_id, data_vencimento DESC);

-- Índice para clientes_transacoes por session_id (JOIN frequente)
CREATE INDEX IF NOT EXISTS idx_transacoes_session 
ON clientes_transacoes(session_id);

-- Índice para clientes_transacoes por cliente_id + data
CREATE INDEX IF NOT EXISTS idx_transacoes_cliente_data 
ON clientes_transacoes(cliente_id, data_transacao DESC);