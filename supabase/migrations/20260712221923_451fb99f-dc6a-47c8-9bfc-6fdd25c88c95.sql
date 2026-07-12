
CREATE OR REPLACE FUNCTION public.protect_session_extras_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_qtd INTEGER;
  v_unit_frozen NUMERIC;
  v_unit_frozen_base NUMERIC;
  v_unit_efetivo NUMERIC;
BEGIN
  IF COALESCE(NEW.extras_overridden, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    g.total_fotos_extras_vendidas,
    NULLIF((g.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((g.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0)
    INTO v_gal_qtd, v_unit_frozen, v_unit_frozen_base
  FROM public.galerias g
  WHERE g.id = NEW.galeria_id;

  IF v_gal_qtd IS NULL THEN
    RETURN NEW;
  END IF;

  -- Unit efetivo: SOMENTE das regras congeladas (fonte da verdade).
  -- Nunca derivar de valor_total_vendido / qtd.
  v_unit_efetivo := COALESCE(
    v_unit_frozen,
    v_unit_frozen_base,
    NULLIF(NEW.valor_foto_extra, 0),
    0
  );

  IF v_unit_efetivo <= 0 THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.qtd_fotos_extra, 0) <> v_gal_qtd
     OR NEW.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
     OR ABS(COALESCE(NEW.valor_total_foto_extra, 0) - ROUND((v_gal_qtd * v_unit_efetivo)::numeric, 2)) > 0.01
  THEN
    NEW.qtd_fotos_extra := v_gal_qtd;
    NEW.valor_foto_extra := v_unit_efetivo;
    NEW.valor_total_foto_extra := ROUND((v_gal_qtd * v_unit_efetivo)::numeric, 2);
  END IF;

  RETURN NEW;
END;
$function$;

-- Sanear novamente sessão 32989f35 (agora sem sobrescrita)
UPDATE public.clientes_sessoes
   SET valor_foto_extra = 2,
       qtd_fotos_extra = 12,
       valor_total_foto_extra = 24,
       updated_at = now()
 WHERE id = '32989f35-0d19-419b-9262-ea3538dc4644';
