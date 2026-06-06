
-- 1. Nova coluna
ALTER TABLE public.etapas_trabalho
  ADD COLUMN IF NOT EXISTS is_hidden_in_workflow boolean NOT NULL DEFAULT false;

-- 2. Trigger de proteção
CREATE OR REPLACE FUNCTION public.protect_system_etapas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
      RAISE EXCEPTION 'O nome de etapas do sistema não pode ser alterado';
    END IF;
    IF NEW.is_system_status IS DISTINCT FROM OLD.is_system_status THEN
      RAISE EXCEPTION 'A flag is_system_status não pode ser alterada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_etapas ON public.etapas_trabalho;
CREATE TRIGGER trg_protect_system_etapas
BEFORE UPDATE OR DELETE ON public.etapas_trabalho
FOR EACH ROW EXECUTE FUNCTION public.protect_system_etapas();

-- 3. Backfill para usuários existentes
DO $$
DECLARE
  u RECORD;
  status_def RECORD;
  next_ordem integer;
  existing_id uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.etapas_trabalho LOOP
    SELECT COALESCE(MAX(ordem), 0) INTO next_ordem
      FROM public.etapas_trabalho WHERE user_id = u.user_id;

    FOR status_def IN
      SELECT * FROM (VALUES
        ('Enviado para seleção', '#3B82F6'),
        ('Seleção finalizada', '#10B981'),
        ('Expirada', '#EF4444')
      ) AS t(nome, cor)
    LOOP
      SELECT id INTO existing_id
        FROM public.etapas_trabalho
       WHERE user_id = u.user_id AND nome = status_def.nome
       LIMIT 1;

      IF existing_id IS NOT NULL THEN
        UPDATE public.etapas_trabalho
           SET is_system_status = true,
               is_hidden_in_workflow = COALESCE(is_hidden_in_workflow, true)
         WHERE id = existing_id AND is_system_status = false;
      ELSE
        next_ordem := next_ordem + 1;
        INSERT INTO public.etapas_trabalho
          (user_id, nome, cor, ordem, is_system_status, is_hidden_in_workflow)
        VALUES
          (u.user_id, status_def.nome, status_def.cor, next_ordem, true, true);
      END IF;
    END LOOP;
  END LOOP;
END $$;
