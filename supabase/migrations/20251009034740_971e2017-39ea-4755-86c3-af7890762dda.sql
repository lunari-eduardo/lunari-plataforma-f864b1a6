-- FASE 2: Remove trigger that auto-calculates valor_total (CORRECTED)
-- This trigger was causing incorrect calculations
-- Frontend will now be responsible for calculating and saving valor_total directly

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_auto_calculate_session_total ON public.clientes_sessoes;

-- Then drop function
DROP FUNCTION IF EXISTS public.auto_calculate_session_total() CASCADE;

-- Log confirmation
DO $$
BEGIN
  RAISE NOTICE 'FASE 2 Complete: Removed auto_calculate_session_total trigger and function';
  RAISE NOTICE 'Frontend is now the single source of truth for valor_total calculation';
END $$;