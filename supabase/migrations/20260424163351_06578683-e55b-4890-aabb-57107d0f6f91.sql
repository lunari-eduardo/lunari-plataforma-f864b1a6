-- =============================================================================
-- FASE 1: Backfill — corrigir todas as sessões com divergência vs galeria
-- =============================================================================
-- Objetivo: para cada sessão vinculada a uma galeria, sincronizar 
-- valor_foto_extra, qtd_fotos_extra e valor_total_foto_extra com os dados da galeria.
-- O trigger recalculate_session_valor_total recalculará valor_total automaticamente.
-- =============================================================================

UPDATE public.clientes_sessoes cs
SET 
  valor_foto_extra = g.valor_foto_extra,
  qtd_fotos_extra = COALESCE(g.total_fotos_extras_vendidas, 0),
  valor_total_foto_extra = COALESCE(g.valor_total_vendido, 0),
  updated_at = now()
FROM public.galerias g
WHERE cs.galeria_id = g.id
  AND (
    cs.valor_foto_extra IS DISTINCT FROM g.valor_foto_extra
    OR cs.qtd_fotos_extra IS DISTINCT FROM COALESCE(g.total_fotos_extras_vendidas, 0)
    OR cs.valor_total_foto_extra IS DISTINCT FROM COALESCE(g.valor_total_vendido, 0)
  );

-- =============================================================================
-- FASE 2: Trigger automático de sync galeria → sessão
-- =============================================================================
-- Garante que qualquer mudança em valor_foto_extra ou total_fotos_extras_vendidas
-- na tabela galerias será propagada à sessão vinculada.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só atualiza se houve mudança real em algum dos campos relevantes
  IF (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
     OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
     OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido) THEN

    UPDATE public.clientes_sessoes
    SET 
      valor_foto_extra = NEW.valor_foto_extra,
      qtd_fotos_extra = COALESCE(NEW.total_fotos_extras_vendidas, 0),
      valor_total_foto_extra = COALESCE(NEW.valor_total_vendido, 0),
      updated_at = now()
    WHERE galeria_id = NEW.id
      AND (
        valor_foto_extra IS DISTINCT FROM NEW.valor_foto_extra
        OR qtd_fotos_extra IS DISTINCT FROM COALESCE(NEW.total_fotos_extras_vendidas, 0)
        OR valor_total_foto_extra IS DISTINCT FROM COALESCE(NEW.valor_total_vendido, 0)
      );

    RAISE NOTICE 'Synced galeria % → session: valor_foto_extra=%, qtd=%, total=%',
      NEW.id, NEW.valor_foto_extra, NEW.total_fotos_extras_vendidas, NEW.valor_total_vendido;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_gallery_extras_to_session ON public.galerias;

CREATE TRIGGER trigger_sync_gallery_extras_to_session
  AFTER UPDATE OF valor_foto_extra, total_fotos_extras_vendidas, valor_total_vendido
  ON public.galerias
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gallery_extras_to_session();