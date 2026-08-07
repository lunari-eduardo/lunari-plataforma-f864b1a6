-- =============================================
-- MÓDULO: MATERIAIS COMERCIAIS
-- Fase 1: Infraestrutura de Dados
-- =============================================

-- 1. Tabela principal: o contêiner do ativo comercial
CREATE TABLE IF NOT EXISTS public.commercial_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  categoria_id    uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  cover_image_url text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_materials_user_id ON public.commercial_materials(user_id);

-- 2. Tabela de versões: cada snapshot do conteúdo
CREATE TABLE IF NOT EXISTS public.material_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     uuid NOT NULL REFERENCES public.commercial_materials(id) ON DELETE CASCADE,
  version_number  integer NOT NULL DEFAULT 1,
  content         jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_material_versions_material_id ON public.material_versions(material_id);

-- 3. Trigger de updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at_commercial_materials()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_commercial_materials ON public.commercial_materials;
CREATE TRIGGER set_updated_at_commercial_materials
  BEFORE UPDATE ON public.commercial_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_commercial_materials();

-- 4. RLS
ALTER TABLE public.commercial_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own materials"
  ON public.commercial_materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own materials"
  ON public.commercial_materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own materials"
  ON public.commercial_materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own materials"
  ON public.commercial_materials FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own versions"
  ON public.material_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_materials
      WHERE id = material_versions.material_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own versions"
  ON public.material_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commercial_materials
      WHERE id = material_versions.material_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own versions"
  ON public.material_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_materials
      WHERE id = material_versions.material_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own versions"
  ON public.material_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_materials
      WHERE id = material_versions.material_id AND user_id = auth.uid()
    )
  );

GRANT ALL ON public.commercial_materials TO authenticated;
GRANT ALL ON public.material_versions TO authenticated;
GRANT ALL ON public.commercial_materials TO service_role;
GRANT ALL ON public.material_versions TO service_role;
