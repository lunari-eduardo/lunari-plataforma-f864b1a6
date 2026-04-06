
CREATE OR REPLACE FUNCTION validate_metas_personalizadas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mes < 0 OR NEW.mes > 12 THEN
    RAISE EXCEPTION 'mes must be between 0 and 12';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_metas_updated_at ON public.metas_personalizadas;
DROP FUNCTION IF EXISTS update_metas_updated_at();
