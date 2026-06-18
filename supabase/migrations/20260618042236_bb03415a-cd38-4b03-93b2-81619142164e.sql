-- 1) Campos favorito e favorited_at em produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorited_at timestamptz;

CREATE OR REPLACE FUNCTION public.produtos_sync_favorited_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.favorito IS TRUE AND NEW.favorited_at IS NULL THEN
      NEW.favorited_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.favorito IS DISTINCT FROM OLD.favorito THEN
      NEW.favorited_at := CASE WHEN NEW.favorito THEN now() ELSE NULL END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produtos_favorited_at_sync ON public.produtos;
CREATE TRIGGER produtos_favorited_at_sync
  BEFORE INSERT OR UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.produtos_sync_favorited_at();

CREATE INDEX IF NOT EXISTS produtos_user_fav_idx
  ON public.produtos (user_id, favorito DESC, favorited_at DESC NULLS LAST, nome ASC);

-- 2) Tabela de etiquetas (catálogo por usuário)
CREATE TABLE IF NOT EXISTS public.produto_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 32),
  cor text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS produto_etiquetas_user_nome_uq
  ON public.produto_etiquetas (user_id, lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_etiquetas TO authenticated;
GRANT ALL ON public.produto_etiquetas TO service_role;

ALTER TABLE public.produto_etiquetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own etiquetas" ON public.produto_etiquetas;
CREATE POLICY "own etiquetas" ON public.produto_etiquetas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS produto_etiquetas_set_updated_at ON public.produto_etiquetas;
CREATE TRIGGER produto_etiquetas_set_updated_at
  BEFORE UPDATE ON public.produto_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tabela de junção produto <-> etiqueta
CREATE TABLE IF NOT EXISTS public.produto_etiqueta_links (
  produto_id uuid NOT NULL,
  etiqueta_id uuid NOT NULL REFERENCES public.produto_etiquetas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (produto_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS produto_etiqueta_links_etiqueta_idx
  ON public.produto_etiqueta_links(etiqueta_id);
CREATE INDEX IF NOT EXISTS produto_etiqueta_links_produto_idx
  ON public.produto_etiqueta_links(produto_id);

GRANT SELECT, INSERT, DELETE ON public.produto_etiqueta_links TO authenticated;
GRANT ALL ON public.produto_etiqueta_links TO service_role;

ALTER TABLE public.produto_etiqueta_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own links" ON public.produto_etiqueta_links;
CREATE POLICY "own links" ON public.produto_etiqueta_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) Cleanup automático de links quando produto é apagado
CREATE OR REPLACE FUNCTION public.produtos_cleanup_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.produto_etiqueta_links WHERE produto_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS produtos_cleanup_links_trg ON public.produtos;
CREATE TRIGGER produtos_cleanup_links_trg
  AFTER DELETE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.produtos_cleanup_links();

-- 5) Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produto_etiquetas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produto_etiqueta_links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;