-- Fix tabelas_precos unique constraints to match onConflict clauses in code

-- Drop existing incorrect unique indexes
DROP INDEX IF EXISTS public.tabelas_precos_global_unique;
DROP INDEX IF EXISTS public.tabelas_precos_categoria_unique;

-- Create correct partial unique indexes that match the onConflict clauses
CREATE UNIQUE INDEX tabelas_precos_global_unique 
  ON public.tabelas_precos (user_id, tipo) 
  WHERE tipo = 'global';

CREATE UNIQUE INDEX tabelas_precos_categoria_unique 
  ON public.tabelas_precos (user_id, tipo, categoria_id) 
  WHERE tipo = 'categoria' AND categoria_id IS NOT NULL;

-- Add missing triggers for updated_at columns
CREATE TRIGGER update_tabelas_precos_updated_at
  BEFORE UPDATE ON public.tabelas_precos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modelo_de_preco_updated_at
  BEFORE UPDATE ON public.modelo_de_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add constraint to ensure categoria_id is required when tipo='categoria'
ALTER TABLE public.tabelas_precos 
ADD CONSTRAINT check_categoria_id_when_categoria 
CHECK (
  (tipo = 'categoria' AND categoria_id IS NOT NULL) OR 
  (tipo != 'categoria')
);