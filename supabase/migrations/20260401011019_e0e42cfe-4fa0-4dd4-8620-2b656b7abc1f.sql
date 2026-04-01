
-- 1. Função handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela
CREATE TABLE IF NOT EXISTS public.metas_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  meta_faturamento NUMERIC(12,2) NOT NULL DEFAULT 0,
  meta_lucro NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Unique index
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_metas_personalizadas_unique') THEN
    CREATE UNIQUE INDEX idx_metas_personalizadas_unique 
    ON public.metas_personalizadas (user_id, ano, mes, COALESCE(categoria, '__geral__'));
  END IF;
END $$;

-- 4. Trigger updated_at
DROP TRIGGER IF EXISTS set_metas_personalizadas_updated_at ON public.metas_personalizadas;
CREATE TRIGGER set_metas_personalizadas_updated_at
  BEFORE UPDATE ON public.metas_personalizadas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Validation
CREATE OR REPLACE FUNCTION public.validate_metas_personalizadas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mes < 1 OR NEW.mes > 12 THEN
    RAISE EXCEPTION 'mes must be between 1 and 12';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_metas_personalizadas_trigger ON public.metas_personalizadas;
CREATE TRIGGER validate_metas_personalizadas_trigger
  BEFORE INSERT OR UPDATE ON public.metas_personalizadas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_metas_personalizadas();

-- 6. RLS
ALTER TABLE public.metas_personalizadas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own metas' AND tablename = 'metas_personalizadas') THEN
    CREATE POLICY "Users can manage own metas"
      ON public.metas_personalizadas
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Campo em pricing_configuracoes
ALTER TABLE public.pricing_configuracoes 
  ADD COLUMN IF NOT EXISTS usar_metas_personalizadas BOOLEAN DEFAULT FALSE;
