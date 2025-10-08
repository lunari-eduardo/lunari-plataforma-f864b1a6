-- FASE 3: Auto-calculate trigger for clientes_sessoes.valor_total
-- FASE 4: Data migration to fix existing sessions

-- Step 1: Create function to calculate manual products value
CREATE OR REPLACE FUNCTION calculate_manual_products_total(produtos jsonb)
RETURNS numeric AS $$
DECLARE
  produto jsonb;
  total numeric := 0;
BEGIN
  -- Loop through products array
  IF produtos IS NOT NULL AND jsonb_typeof(produtos) = 'array' THEN
    FOR produto IN SELECT * FROM jsonb_array_elements(produtos)
    LOOP
      -- Only count manual products with valorUnitario > 0
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create trigger function to auto-calculate valor_total
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
  -- Get base package value (preserve existing valor_total as base)
  valor_base := COALESCE(NEW.valor_total, 0);
  
  -- Get extra photos value
  valor_fotos_extras := COALESCE(NEW.valor_total_foto_extra, 0);
  
  -- Calculate manual products value
  valor_produtos_manuais := calculate_manual_products_total(NEW.produtos_incluidos);
  
  -- Get additional value
  valor_adicional := COALESCE(NEW.valor_adicional, 0);
  
  -- Get discount
  desconto := COALESCE(NEW.desconto, 0);
  
  -- Calculate total: base + fotos_extras + produtos_manuais + adicional - desconto
  total_calculado := valor_base + valor_fotos_extras + valor_produtos_manuais + valor_adicional - desconto;
  
  -- Ensure total is never negative
  IF total_calculado < 0 THEN
    total_calculado := 0;
  END IF;
  
  -- Update valor_total with calculated value
  NEW.valor_total := total_calculado;
  
  -- Log for debugging (visible in DB logs)
  RAISE NOTICE 'Auto-calculated valor_total for session %: base=%, fotos=%, produtos=%, adicional=%, desconto=%, total=%',
    NEW.session_id, valor_base, valor_fotos_extras, valor_produtos_manuais, valor_adicional, desconto, total_calculado;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on clientes_sessoes
DROP TRIGGER IF EXISTS trigger_auto_calculate_session_total ON clientes_sessoes;
CREATE TRIGGER trigger_auto_calculate_session_total
  BEFORE INSERT OR UPDATE ON clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_session_total();

-- Step 4: Data migration - Fix existing sessions with incorrect valor_total
-- This will recalculate valor_total for all existing sessions
UPDATE clientes_sessoes
SET 
  -- Force trigger to recalculate by updating updated_at
  updated_at = now()
WHERE 
  -- Only update sessions that have extras, additionals, or discounts
  (COALESCE(valor_total_foto_extra, 0) > 0 OR 
   COALESCE(valor_adicional, 0) > 0 OR 
   COALESCE(desconto, 0) > 0 OR
   calculate_manual_products_total(produtos_incluidos) > 0)
  AND
  -- And the current valor_total doesn't match the correct calculation
  valor_total != (
    COALESCE(valor_total, 0) + 
    COALESCE(valor_total_foto_extra, 0) + 
    calculate_manual_products_total(produtos_incluidos) + 
    COALESCE(valor_adicional, 0) - 
    COALESCE(desconto, 0)
  );

-- Log migration results
DO $$
DECLARE
  affected_count integer;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Data migration completed: % sessions updated with correct valor_total', affected_count;
END $$;