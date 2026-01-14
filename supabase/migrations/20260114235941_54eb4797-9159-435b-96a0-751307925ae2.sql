-- 1. Verificar e criar trigger INSERT se não existir
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_insert ON public.clientes_transacoes;

CREATE TRIGGER trigger_recompute_session_paid_insert
  AFTER INSERT ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_session_paid();

-- 2. Corrigir dados existentes - recalcular valor_pago para TODAS as sessões
UPDATE clientes_sessoes cs
SET valor_pago = COALESCE(
  (
    SELECT SUM(ct.valor)
    FROM clientes_transacoes ct
    WHERE ct.session_id = cs.session_id
      AND ct.tipo = 'pagamento'
  ),
  0
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM clientes_transacoes ct 
  WHERE ct.session_id = cs.session_id
);

-- 3. Criar função utilitária para correções futuras
CREATE OR REPLACE FUNCTION public.fix_all_valor_pago()
RETURNS INTEGER AS $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  UPDATE clientes_sessoes cs
  SET valor_pago = COALESCE(
    (
      SELECT SUM(ct.valor)
      FROM clientes_transacoes ct
      WHERE ct.session_id = cs.session_id
        AND ct.tipo = 'pagamento'
    ),
    0
  ),
  updated_at = NOW()
  WHERE cs.valor_pago IS DISTINCT FROM COALESCE(
    (
      SELECT SUM(ct.valor)
      FROM clientes_transacoes ct
      WHERE ct.session_id = cs.session_id
        AND ct.tipo = 'pagamento'
    ),
    0
  );
  
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RETURN v_fixed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;