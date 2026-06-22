ALTER TABLE public.etapas_trabalho
  ADD COLUMN IF NOT EXISTS is_hidden_in_workflow boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_system_etapas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_status THEN
      RAISE EXCEPTION 'Etapas do sistema não podem ser excluídas';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_system_status THEN
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN
      RAISE EXCEPTION 'Etapas do sistema têm o nome protegido';
    END IF;
    IF NEW.is_system_status IS DISTINCT FROM OLD.is_system_status THEN
      RAISE EXCEPTION 'A flag is_system_status de etapas do sistema não pode ser alterada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_etapas ON public.etapas_trabalho;
CREATE TRIGGER trg_protect_system_etapas
BEFORE UPDATE OR DELETE ON public.etapas_trabalho
FOR EACH ROW EXECUTE FUNCTION public.protect_system_etapas();