
-- =====================================================
-- Parte 0: Corrigir check constraint para aceitar valores reais
-- =====================================================
ALTER TABLE public.clientes_sessoes DROP CONSTRAINT IF EXISTS sessoes_status_galeria_check;
ALTER TABLE public.clientes_sessoes ADD CONSTRAINT sessoes_status_galeria_check
  CHECK (status_galeria IS NULL OR status_galeria IN (
    'enviado', 'enviada', 'selecao_iniciada', 'em_selecao', 
    'selecao_completa', 'expirada', 'excluida', 'rascunho'
  ));

-- =====================================================
-- Parte 1: Corrigir função sync_gallery_status_to_session
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
BEGIN
  -- Buscar sessão vinculada pela galeria_id
  SELECT id, status INTO session_record
  FROM public.clientes_sessoes
  WHERE galeria_id = NEW.id
  LIMIT 1;

  -- Fallback: buscar por session_id
  IF session_record.id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT id, status INTO session_record
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id
    LIMIT 1;
  END IF;

  IF session_record.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapeamento CORRETO dos status reais da tabela galerias
  CASE NEW.status
    WHEN 'enviado' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_iniciada' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_completa' THEN target_status := 'Seleção finalizada';
    WHEN 'expirada' THEN target_status := 'Expirada';
    ELSE target_status := session_record.status;
  END CASE;

  UPDATE public.clientes_sessoes
  SET status = target_status,
      status_galeria = NEW.status,
      status_pagamento_fotos_extra = COALESCE(NEW.status_pagamento, 'sem_vendas'),
      updated_at = NOW()
  WHERE id = session_record.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- Parte 2: Recriar trigger para INSERT E UPDATE
-- =====================================================
DROP TRIGGER IF EXISTS trigger_sync_gallery_status ON public.galerias;
CREATE TRIGGER trigger_sync_gallery_status
AFTER INSERT OR UPDATE OF status, status_pagamento ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.sync_gallery_status_to_session();

-- =====================================================
-- Parte 3: Sincronizar sessões existentes dessincronizadas
-- =====================================================
UPDATE public.clientes_sessoes cs
SET status = 'Enviado para seleção',
    status_galeria = g.status,
    updated_at = NOW()
FROM public.galerias g
WHERE (cs.galeria_id = g.id OR (cs.session_id = g.session_id AND g.session_id IS NOT NULL))
  AND g.status IN ('enviado', 'selecao_iniciada')
  AND cs.status NOT IN ('Enviado para seleção');

UPDATE public.clientes_sessoes cs
SET status = 'Seleção finalizada',
    status_galeria = g.status,
    updated_at = NOW()
FROM public.galerias g
WHERE (cs.galeria_id = g.id OR (cs.session_id = g.session_id AND g.session_id IS NOT NULL))
  AND g.status = 'selecao_completa'
  AND cs.status NOT IN ('Seleção finalizada');

UPDATE public.clientes_sessoes cs
SET status = 'Expirada',
    status_galeria = g.status,
    updated_at = NOW()
FROM public.galerias g
WHERE (cs.galeria_id = g.id OR (cs.session_id = g.session_id AND g.session_id IS NOT NULL))
  AND g.status = 'expirada'
  AND cs.status NOT IN ('Expirada');
