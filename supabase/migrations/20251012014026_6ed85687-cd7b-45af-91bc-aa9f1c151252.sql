-- Corrigir security warning: definir search_path nas funções
CREATE OR REPLACE FUNCTION public.update_fin_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;