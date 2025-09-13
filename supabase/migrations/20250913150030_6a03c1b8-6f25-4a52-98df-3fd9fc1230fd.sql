-- Fix the function search_path security warning
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total value based on quantity and unit value
  IF NEW.qtd_fotos_extra IS NOT NULL AND NEW.valor_foto_extra IS NOT NULL THEN
    NEW.valor_total_foto_extra = NEW.qtd_fotos_extra * NEW.valor_foto_extra;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;