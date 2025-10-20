-- FASE 1: Adicionar Constraints para Prevenir Duplicatas

-- 1.1: Constraint para evitar agendamentos duplicados no mesmo horário
ALTER TABLE appointments 
ADD CONSTRAINT unique_user_date_time 
UNIQUE (user_id, date, time);

-- 1.2: Index único para session_id (quando não nulo)
CREATE UNIQUE INDEX unique_appointment_session_id 
ON appointments(user_id, session_id) 
WHERE session_id IS NOT NULL AND session_id != '';

-- 1.3: Index único para appointment_id em clientes_sessoes (quando não nulo)
CREATE UNIQUE INDEX unique_session_appointment_id 
ON clientes_sessoes(user_id, appointment_id) 
WHERE appointment_id IS NOT NULL;

-- 1.4: Constraint para evitar session_id duplicado em clientes_sessoes
ALTER TABLE clientes_sessoes 
ADD CONSTRAINT unique_clientes_sessoes_session_id 
UNIQUE (user_id, session_id);

-- Comentários explicativos
COMMENT ON CONSTRAINT unique_user_date_time ON appointments IS 
'Impede duplicação de agendamentos no mesmo horário para o mesmo usuário';

COMMENT ON INDEX unique_appointment_session_id IS 
'Garante que session_id seja único por usuário (quando preenchido)';

COMMENT ON INDEX unique_session_appointment_id IS 
'Garante que cada appointment_id tenha no máximo uma sessão associada';

COMMENT ON CONSTRAINT unique_clientes_sessoes_session_id ON clientes_sessoes IS 
'Impede session_id duplicado na tabela de sessões';