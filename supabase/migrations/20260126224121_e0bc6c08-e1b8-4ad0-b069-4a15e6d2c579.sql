-- FASE 1: Adicionar coluna is_system_status na tabela etapas_trabalho
ALTER TABLE etapas_trabalho
ADD COLUMN is_system_status BOOLEAN DEFAULT false;

-- Índice para performance
CREATE INDEX idx_etapas_system_status ON etapas_trabalho(user_id, is_system_status);

-- FASE 2: Trigger function que atualiza status da sessão quando galeria muda de status
CREATE OR REPLACE FUNCTION sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
  status_exists BOOLEAN;
BEGIN
  -- Só processar se status mudou
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Buscar sessão vinculada
  SELECT id, session_id, status INTO session_record
  FROM clientes_sessoes
  WHERE (session_id = NEW.session_id OR galeria_id = NEW.id)
    AND user_id = NEW.user_id
  LIMIT 1;

  IF session_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapear status da galeria para status da sessão
  CASE NEW.status
    WHEN 'enviado' THEN
      target_status := 'Enviado para seleção';
    WHEN 'selecao_iniciada' THEN
      target_status := 'Enviado para seleção';
    WHEN 'selecao_completa' THEN
      target_status := 'Seleção finalizada';
    ELSE
      RETURN NEW;
  END CASE;

  -- Verificar se o status de destino existe nas etapas do usuário como system status
  SELECT EXISTS(
    SELECT 1 FROM etapas_trabalho
    WHERE user_id = NEW.user_id 
      AND nome = target_status
      AND is_system_status = true
  ) INTO status_exists;

  -- Só atualizar se o status de sistema existe (usuário tem PRO + Gallery ativo)
  IF status_exists THEN
    UPDATE clientes_sessoes
    SET status = target_status,
        status_galeria = NEW.status,
        updated_at = NOW()
    WHERE id = session_record.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger na tabela galerias
DROP TRIGGER IF EXISTS trigger_sync_gallery_status ON galerias;
CREATE TRIGGER trigger_sync_gallery_status
AFTER UPDATE OF status ON galerias
FOR EACH ROW
EXECUTE FUNCTION sync_gallery_status_to_session();