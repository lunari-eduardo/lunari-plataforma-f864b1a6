-- 1. Reforçar o trigger de sincronização de versão ativa
-- O trigger anterior só disparava no UPDATE. Agora garantimos INSERT e UPDATE.
-- E fazemos um reparo nos dados órfãos.

CREATE OR REPLACE FUNCTION public.sync_active_version_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se a versão foi publicada (published_at não nulo)
  IF NEW.published_at IS NOT NULL THEN
    -- Atualiza o material pai para apontar para esta versão como a ativa
    -- apenas se for a versão mais alta publicada ou se o material não tiver versão ativa
    UPDATE public.commercial_materials 
    SET 
        active_version_id = NEW.id,
        updated_at = now() 
    WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir com nome diferente
DROP TRIGGER IF EXISTS trigger_sync_active_version ON public.material_versions;

CREATE TRIGGER trigger_sync_active_version
  AFTER INSERT OR UPDATE OF published_at
  ON public.material_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_active_version_on_publish();

-- 2. Reparo de dados: materiais publicados que estão com active_version_id nulo
UPDATE public.commercial_materials m
SET active_version_id = (
    SELECT v.id 
    FROM public.material_versions v 
    WHERE v.material_id = m.id 
      AND v.published_at IS NOT NULL 
    ORDER BY v.version_number DESC 
    LIMIT 1
)
WHERE m.active_version_id IS NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.material_versions v 
    WHERE v.material_id = m.id AND v.published_at IS NOT NULL
  );

-- 3. Ativar RLS nas tabelas de compartilhamento
ALTER TABLE public.material_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_shares ENABLE ROW LEVEL SECURITY;

-- 4. Garantir privilégios (Supabase PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_share_links TO authenticated;
GRANT ALL ON public.material_share_links TO service_role;
GRANT SELECT ON public.material_share_links TO anon; -- Necessário para visualização pública via slug

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_shares TO authenticated;
GRANT ALL ON public.material_shares TO service_role;
GRANT SELECT ON public.material_shares TO anon; -- Necessário para rastreamento de abertura (token)

-- 5. Políticas de isolamento por user_id
DROP POLICY IF EXISTS "Users can manage own share links" ON public.material_share_links;
CREATE POLICY "Users can manage own share links" 
ON public.material_share_links 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view active share links" ON public.material_share_links;
CREATE POLICY "Anyone can view active share links" 
ON public.material_share_links 
FOR SELECT 
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Users can manage own shares" ON public.material_shares;
CREATE POLICY "Users can manage own shares" 
ON public.material_shares 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view active shares" ON public.material_shares;
CREATE POLICY "Anyone can view active shares" 
ON public.material_shares 
FOR SELECT 
TO anon, authenticated
USING (is_active = true);
