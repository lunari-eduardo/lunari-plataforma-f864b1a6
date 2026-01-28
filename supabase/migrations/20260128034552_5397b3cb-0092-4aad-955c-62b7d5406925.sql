-- Fase 1: Adicionar coluna para status de pagamento de fotos extras
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS status_pagamento_fotos_extra TEXT DEFAULT 'sem_vendas';

-- Atualizar função de sincronização para incluir status_pagamento
CREATE OR REPLACE FUNCTION sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
BEGIN
  -- Buscar sessão vinculada à galeria
  SELECT id, status INTO session_record
  FROM clientes_sessoes
  WHERE galeria_id = NEW.id
  LIMIT 1;
  
  -- Se não encontrou por galeria_id, tentar por session_id
  IF session_record.id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT id, status INTO session_record
    FROM clientes_sessoes
    WHERE session_id = NEW.session_id
    LIMIT 1;
  END IF;
  
  -- Se não encontrou sessão, não fazer nada
  IF session_record.id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Mapear status da galeria para status do workflow
  CASE NEW.status
    WHEN 'publicada' THEN target_status := 'Enviado para seleção';
    WHEN 'em_selecao' THEN target_status := 'Enviado para seleção';
    WHEN 'finalizada' THEN target_status := 'Seleção finalizada';
    ELSE target_status := session_record.status; -- Manter status atual
  END CASE;
  
  -- Atualizar sessão com status da galeria E status de pagamento
  UPDATE clientes_sessoes
  SET status = target_status,
      status_galeria = NEW.status,
      status_pagamento_fotos_extra = COALESCE(NEW.status_pagamento, 'sem_vendas'),
      updated_at = NOW()
  WHERE id = session_record.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger existe para mudanças de status
DROP TRIGGER IF EXISTS trigger_sync_gallery_status ON galerias;
CREATE TRIGGER trigger_sync_gallery_status
AFTER UPDATE OF status, status_pagamento ON galerias
FOR EACH ROW
EXECUTE FUNCTION sync_gallery_status_to_session();

-- Sincronizar dados existentes das galerias para sessões
UPDATE clientes_sessoes cs
SET status_pagamento_fotos_extra = COALESCE(g.status_pagamento, 'sem_vendas')
FROM galerias g
WHERE cs.galeria_id = g.id
  OR cs.session_id = g.session_id;