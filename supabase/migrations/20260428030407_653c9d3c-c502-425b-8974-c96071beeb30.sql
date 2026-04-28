-- Atualiza a função de recálculo de fotos extras para usar fallback do preço congelado
-- quando valor_foto_extra da sessão estiver zerado ou nulo.

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
  -- 1) Galeria vinculada com vendas consolidadas: a sessão respeita o total cobrado
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

  -- 2) Ramo padrão: total = qtd × preço unitário
  --    Fallback: se valor_foto_extra estiver 0/NULL, usar regras congeladas do pacote.
  v_fallback_preco := COALESCE(
    NULLIF(NEW.valor_foto_extra, 0),
    NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    0
  );

  -- Persistir o unitário resolvido (facilita UI e próximas triggers)
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

-- Reexecutar triggers nas sessões afetadas (galeria sem vendas + preço zerado + regras congeladas válidas)
UPDATE public.clientes_sessoes s
SET updated_at = now()
WHERE (s.valor_foto_extra IS NULL OR s.valor_foto_extra = 0)
  AND s.regras_congeladas IS NOT NULL
  AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
  AND COALESCE(
        (s.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
        (s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric,
        0
      ) > 0;