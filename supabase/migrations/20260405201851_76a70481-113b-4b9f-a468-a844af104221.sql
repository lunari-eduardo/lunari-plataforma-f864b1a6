
CREATE OR REPLACE FUNCTION public.update_metas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_metas_updated_at
BEFORE UPDATE ON public.metas_personalizadas
FOR EACH ROW EXECUTE FUNCTION public.update_metas_updated_at();
