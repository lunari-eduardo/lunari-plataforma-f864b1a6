
CREATE OR REPLACE FUNCTION public.ensure_produtos_incluidos_have_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_arr jsonb;
  v_item jsonb;
  v_new jsonb := '[]'::jsonb;
  v_changed boolean := false;
BEGIN
  IF NEW.produtos_incluidos IS NULL OR jsonb_typeof(NEW.produtos_incluidos) <> 'array' THEN
    RETURN NEW;
  END IF;
  v_arr := NEW.produtos_incluidos;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_arr)
  LOOP
    IF v_item ? 'id'
       AND jsonb_typeof(v_item->'id') = 'string'
       AND length(v_item->>'id') > 0 THEN
      v_new := v_new || v_item;
    ELSE
      v_new := v_new || (v_item || jsonb_build_object('id', gen_random_uuid()::text));
      v_changed := true;
    END IF;
  END LOOP;
  IF v_changed THEN
    NEW.produtos_incluidos := v_new;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_produtos_incluidos_ids ON public.clientes_sessoes;
CREATE TRIGGER trg_ensure_produtos_incluidos_ids
BEFORE INSERT OR UPDATE OF produtos_incluidos ON public.clientes_sessoes
FOR EACH ROW EXECUTE FUNCTION public.ensure_produtos_incluidos_have_ids();
