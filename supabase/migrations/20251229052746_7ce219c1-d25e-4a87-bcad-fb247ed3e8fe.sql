-- Adicionar campos para sincronização com Google Calendar na tabela appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_sync_status TEXT DEFAULT 'pending';

-- Índice para buscar eventos sincronizados
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id ON appointments(google_event_id) WHERE google_event_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN appointments.google_event_id IS 'ID do evento no Google Calendar';
COMMENT ON COLUMN appointments.google_sync_status IS 'Status da sincronização: pending, synced, error, deleted';