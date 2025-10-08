-- Fix security warnings: Set search_path for new functions

-- Fix calculate_manual_products_total function
CREATE OR REPLACE FUNCTION calculate_manual_products_total(produtos jsonb)
RETURNS numeric AS $$
DECLARE
  produto jsonb;
  total numeric := 0;
BEGIN
  IF produtos IS NOT NULL AND jsonb_typeof(produtos) = 'array' THEN
    FOR produto IN SELECT * FROM jsonb_array_elements(produtos)
    LOOP
      IF (produto->>'tipo' = 'manual') AND 
         ((produto->>'valorUnitario')::numeric > 0) THEN
        total := total + (
          COALESCE((produto->>'quantidade')::numeric, 0) * 
          COALESCE((produto->>'valorUnitario')::numeric, 0)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public;

-- Fix auto_calculate_session_total function
CREATE OR REPLACE FUNCTION auto_calculate_session_total()
RETURNS TRIGGER AS $$
DECLARE
  valor_base numeric;
  valor_fotos_extras numeric;
  valor_produtos_manuais numeric;
  valor_adicional numeric;
  desconto numeric;
  total_calculado numeric;
BEGIN
  valor_base := COALESCE(NEW.valor_total, 0);
  valor_fotos_extras := COALESCE(NEW.valor_total_foto_extra, 0);
  valor_produtos_manuais := calculate_manual_products_total(NEW.produtos_incluidos);
  valor_adicional := COALESCE(NEW.valor_adicional, 0);
  desconto := COALESCE(NEW.desconto, 0);
  
  total_calculado := valor_base + valor_fotos_extras + valor_produtos_manuais + valor_adicional - desconto;
  
  IF total_calculado < 0 THEN
    total_calculado := 0;
  END IF;
  
  NEW.valor_total := total_calculado;
  
  RAISE NOTICE 'Auto-calculated valor_total for session %: base=%, fotos=%, produtos=%, adicional=%, desconto=%, total=%',
    NEW.session_id, valor_base, valor_fotos_extras, valor_produtos_manuais, valor_adicional, desconto, total_calculado;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;