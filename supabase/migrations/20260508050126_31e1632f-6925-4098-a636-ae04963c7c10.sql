
-- Add override flag for manual edits to fotos extras
ALTER TABLE public.clientes_sessoes
  ADD COLUMN IF NOT EXISTS extras_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extras_overridden_at timestamptz;

-- Update protect_session_extras_consistency: respect override
CREATE OR REPLACE FUNCTION public.protect_session_extras_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_total NUMERIC;
  v_gal_qtd INTEGER;
BEGIN
  -- Respect manual override
  IF COALESCE(NEW.extras_overridden, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT g.valor_total_vendido, g.total_fotos_extras_vendidas
    INTO v_gal_total, v_gal_qtd
  FROM public.galerias g
  WHERE g.id = NEW.galeria_id;
  
  IF v_gal_total IS NOT NULL AND v_gal_total > 0 
     AND v_gal_qtd IS NOT NULL AND v_gal_qtd > 0 THEN
    
    IF ABS(COALESCE(NEW.valor_total_foto_extra, 0) - v_gal_total) > 0.01
       OR COALESCE(NEW.qtd_fotos_extra, 0) <> v_gal_qtd THEN
      
      RAISE NOTICE 'Auto-corrigindo divergência sessão %: extras=% (galeria=%), qtd=% (galeria=%)',
        NEW.id, NEW.valor_total_foto_extra, v_gal_total, NEW.qtd_fotos_extra, v_gal_qtd;
      
      NEW.qtd_fotos_extra := v_gal_qtd;
      NEW.valor_total_foto_extra := v_gal_total;
      NEW.valor_foto_extra := ROUND((v_gal_total / v_gal_qtd)::numeric, 2);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update recalculate_fotos_extras_total: skip gallery branch if override
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_total NUMERIC;
  v_gal_qtd INTEGER;
  v_fallback_preco NUMERIC;
BEGIN
  -- Respect manual override: pular sincronização da galeria, usar qtd × valor_foto_extra
  IF COALESCE(NEW.extras_overridden, false) = true THEN
    IF NEW.qtd_fotos_extra IS NOT NULL THEN
      NEW.valor_total_foto_extra := ROUND(
        (COALESCE(NEW.qtd_fotos_extra, 0) * COALESCE(NEW.valor_foto_extra, 0))::numeric,
        2
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NOT NULL THEN
    SELECT g.valor_total_vendido, g.total_fotos_extras_vendidas
      INTO v_gal_total, v_gal_qtd
    FROM public.galerias g
    WHERE g.id = NEW.galeria_id;

    IF v_gal_total IS NOT NULL
       AND v_gal_total > 0
       AND v_gal_qtd IS NOT NULL
       AND v_gal_qtd > 0
       AND COALESCE(NEW.qtd_fotos_extra, 0) = v_gal_qtd THEN

      NEW.valor_total_foto_extra := v_gal_total;
      NEW.valor_foto_extra := ROUND((v_gal_total / v_gal_qtd)::numeric, 2);
      RETURN NEW;
    END IF;
  END IF;

  v_fallback_preco := COALESCE(
    NULLIF(NEW.valor_foto_extra, 0),
    NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    0
  );

  IF v_fallback_preco > 0
     AND (NEW.valor_foto_extra IS NULL OR NEW.valor_foto_extra = 0) THEN
    NEW.valor_foto_extra := v_fallback_preco;
  END IF;

  IF NEW.qtd_fotos_extra IS NOT NULL THEN
    NEW.valor_total_foto_extra := ROUND(
      (COALESCE(NEW.qtd_fotos_extra, 0) * v_fallback_preco)::numeric,
      2
    );
  END IF;

  RETURN NEW;
END;
$function$;
