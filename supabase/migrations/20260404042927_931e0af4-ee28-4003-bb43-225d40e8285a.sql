
-- 1. Fix CASCADE on cobrancas.galeria_id -> SET NULL
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_galeria_id_fkey;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_galeria_id_fkey 
  FOREIGN KEY (galeria_id) REFERENCES public.galerias(id) ON DELETE SET NULL;

-- 2. Update recompute_session_paid to handle estornos
CREATE OR REPLACE FUNCTION public.recompute_session_paid(p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clientes_sessoes
  SET 
    valor_pago = (
      SELECT COALESCE(SUM(
        CASE WHEN tipo = 'estorno' THEN -valor ELSE valor END
      ), 0)
      FROM public.clientes_transacoes
      WHERE session_id = p_session_id AND tipo IN ('pagamento', 'estorno')
    ),
    updated_at = NOW()
  WHERE session_id = p_session_id;
  
  RAISE NOTICE 'Recalculado valor_pago para session_id: %', p_session_id;
END;
$function$;

-- 3. Update fix_all_valor_pago to match
CREATE OR REPLACE FUNCTION public.fix_all_valor_pago()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  UPDATE clientes_sessoes cs
  SET valor_pago = COALESCE(
    (
      SELECT SUM(
        CASE WHEN ct.tipo = 'estorno' THEN -ct.valor ELSE ct.valor END
      )
      FROM clientes_transacoes ct
      WHERE ct.session_id = cs.session_id
        AND ct.tipo IN ('pagamento', 'estorno')
    ),
    0
  ),
  updated_at = NOW()
  WHERE cs.valor_pago IS DISTINCT FROM COALESCE(
    (
      SELECT SUM(
        CASE WHEN ct.tipo = 'estorno' THEN -ct.valor ELSE ct.valor END
      )
      FROM clientes_transacoes ct
      WHERE ct.session_id = cs.session_id
        AND ct.tipo IN ('pagamento', 'estorno')
    ),
    0
  );
  
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RETURN v_fixed;
END;
$function$;
