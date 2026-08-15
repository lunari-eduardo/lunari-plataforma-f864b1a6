-- Atualiza a função de vínculo (galeria -> sessão)
-- para que quando uma galeria nova (ou atualizada) assumir uma sessão, 
-- ela desfaça o bloqueio de "override manual" (extras_overridden = false)
-- e limpe o snapshot de proteção.

CREATE OR REPLACE FUNCTION public.tie_session_galeria_fk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
  
  UPDATE public.clientes_sessoes s
     SET galeria_id = NEW.id,
         extras_overridden = false,
         snapshot_extras_at_gallery_delete = NULL,
         updated_at = now()
   WHERE s.user_id = NEW.user_id
     AND s.session_id = NEW.session_id
     AND (s.galeria_id IS NULL OR s.galeria_id <> NEW.id);
     
  RETURN NEW;
END;
$$;
