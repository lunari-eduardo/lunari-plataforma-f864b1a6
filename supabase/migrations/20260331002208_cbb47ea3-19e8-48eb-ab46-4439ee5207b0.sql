
-- Trigger: propagate category name changes to clientes_sessoes
CREATE OR REPLACE FUNCTION public.on_categoria_renamed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when nome actually changed
  IF OLD.nome IS DISTINCT FROM NEW.nome THEN
    UPDATE public.clientes_sessoes
    SET categoria = NEW.nome,
        updated_at = now()
    WHERE categoria = OLD.nome
      AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_categoria_renamed ON public.categorias;
CREATE TRIGGER trg_on_categoria_renamed
  AFTER UPDATE ON public.categorias
  FOR EACH ROW
  EXECUTE FUNCTION public.on_categoria_renamed();
