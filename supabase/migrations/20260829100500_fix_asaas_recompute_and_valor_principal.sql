-- 1. Create a trigger function to recompute session paid when parcelas change
CREATE OR REPLACE FUNCTION public.trigger_recompute_session_paid_from_parcelas()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id TEXT;
  v_cobranca_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cobranca_id := OLD.cobranca_id;
  ELSE
    v_cobranca_id := NEW.cobranca_id;
  END IF;

  SELECT COALESCE(session_id, (SELECT session_id FROM public.galerias WHERE id = cobrancas.galeria_id LIMIT 1))
  INTO v_session_id
  FROM public.cobrancas 
  WHERE id = v_cobranca_id;

  IF v_session_id IS NOT NULL THEN
    PERFORM public.recompute_session_paid(v_session_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to cobranca_parcelas
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_parcelas_insert ON public.cobranca_parcelas;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_parcelas_update ON public.cobranca_parcelas;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_parcelas_delete ON public.cobranca_parcelas;

CREATE TRIGGER trigger_recompute_session_paid_parcelas_insert
    AFTER INSERT ON public.cobranca_parcelas
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid_from_parcelas();

CREATE TRIGGER trigger_recompute_session_paid_parcelas_update
    AFTER UPDATE OF status, valor_principal, valor_bruto ON public.cobranca_parcelas
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid_from_parcelas();

CREATE TRIGGER trigger_recompute_session_paid_parcelas_delete
    AFTER DELETE ON public.cobranca_parcelas
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_recompute_session_paid_from_parcelas();

-- 3. Fix historically missing valor_principal in cobranca_parcelas
UPDATE public.cobranca_parcelas cp
SET valor_principal = ROUND((c.valor_principal / GREATEST(c.total_parcelas, 1))::numeric, 2)
FROM public.cobrancas c
WHERE c.id = cp.cobranca_id 
  AND c.provedor = 'asaas'
  AND (cp.valor_principal IS NULL OR cp.valor_principal = cp.valor_bruto);

-- 4. Recompute all session totals to apply the fixed valor_principal amounts
SELECT public.fix_all_valor_pago();
