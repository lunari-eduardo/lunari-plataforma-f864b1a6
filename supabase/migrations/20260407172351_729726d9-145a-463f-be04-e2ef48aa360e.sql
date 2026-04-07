CREATE OR REPLACE FUNCTION public.update_formulario_status_on_resposta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.formularios 
  SET status_envio = 'respondido', respondido_em = NOW(), updated_at = NOW()
  WHERE id = NEW.formulario_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_formulario_on_resposta
AFTER INSERT ON public.formulario_respostas
FOR EACH ROW
EXECUTE FUNCTION public.update_formulario_status_on_resposta();