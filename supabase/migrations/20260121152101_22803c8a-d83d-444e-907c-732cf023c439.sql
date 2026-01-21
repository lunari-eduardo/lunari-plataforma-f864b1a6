-- =============================================================================
-- FASE 2: Trigger para recálculo automático de valor_total em clientes_sessoes
-- =============================================================================

-- Função helper para calcular total de produtos manuais (já existe, mas garantindo)
CREATE OR REPLACE FUNCTION public.calculate_manual_products_total(produtos JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  produto JSONB;
  total NUMERIC := 0;
BEGIN
  IF produtos IS NOT NULL AND jsonb_typeof(produtos) = 'array' THEN
    FOR produto IN SELECT * FROM jsonb_array_elements(produtos)
    LOOP
      -- Apenas produtos do tipo 'manual' são contabilizados
      IF (produto->>'tipo' = 'manual') AND 
         ((produto->>'valorUnitario')::NUMERIC > 0) THEN
        total := total + (
          COALESCE((produto->>'quantidade')::NUMERIC, 0) * 
          COALESCE((produto->>'valorUnitario')::NUMERIC, 0)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN total;
END;
$$;

-- Função trigger para recalcular valor_total automaticamente
CREATE OR REPLACE FUNCTION public.recalculate_session_valor_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_valor_produtos NUMERIC;
  v_novo_total NUMERIC;
BEGIN
  -- Calcular total de produtos manuais
  v_valor_produtos := public.calculate_manual_products_total(NEW.produtos_incluidos);
  
  -- Calcular novo total: base + foto_extra + produtos + adicional - desconto
  v_novo_total := GREATEST(0,
    COALESCE(NEW.valor_base_pacote, 0) +
    COALESCE(NEW.valor_total_foto_extra, 0) +
    v_valor_produtos +
    COALESCE(NEW.valor_adicional, 0) -
    COALESCE(NEW.desconto, 0)
  );
  
  -- Atualizar valor_total apenas se mudou ou é INSERT
  IF TG_OP = 'INSERT' OR NEW.valor_total IS DISTINCT FROM v_novo_total THEN
    NEW.valor_total := v_novo_total;
    RAISE NOTICE 'Session % valor_total recalculated: % (base=%, foto_extra=%, produtos=%, adicional=%, desconto=%)',
      NEW.id, v_novo_total, NEW.valor_base_pacote, NEW.valor_total_foto_extra, 
      v_valor_produtos, NEW.valor_adicional, NEW.desconto;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Dropar trigger existente se houver para evitar duplicação
DROP TRIGGER IF EXISTS trigger_recalculate_valor_total ON public.clientes_sessoes;

-- Criar trigger BEFORE INSERT OR UPDATE nos campos que afetam o total
CREATE TRIGGER trigger_recalculate_valor_total
  BEFORE INSERT OR UPDATE OF valor_base_pacote, valor_total_foto_extra, 
    valor_adicional, produtos_incluidos, desconto
  ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_session_valor_total();

-- =============================================================================
-- FASE 3: Limpar triggers duplicados de recompute_paid
-- =============================================================================

-- Verificar e manter apenas 1 trigger para clientes_transacoes
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_update ON public.clientes_transacoes;
DROP TRIGGER IF EXISTS trigger_recompute_session_paid_delete ON public.clientes_transacoes;

-- Garantir que o trigger principal cobre todos os eventos
DROP TRIGGER IF EXISTS recompute_paid_amount ON public.clientes_transacoes;

-- Recriar trigger único que cobre INSERT, UPDATE e DELETE
CREATE TRIGGER recompute_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_session_paid();

-- =============================================================================
-- FASE 4: Adicionar coluna computada status_financeiro
-- =============================================================================

-- Adicionar coluna status_financeiro como campo GENERATED
-- PostgreSQL 12+ suporta GENERATED ALWAYS AS
ALTER TABLE public.clientes_sessoes 
ADD COLUMN IF NOT EXISTS status_financeiro TEXT 
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(valor_pago, 0) >= COALESCE(valor_total, 0) AND COALESCE(valor_total, 0) > 0 THEN 'pago'
    WHEN COALESCE(valor_pago, 0) > 0 THEN 'parcial'
    ELSE 'pendente'
  END
) STORED;

-- Índice para consultas filtradas por status financeiro
CREATE INDEX IF NOT EXISTS idx_sessoes_status_financeiro 
ON public.clientes_sessoes(user_id, data_sessao, status_financeiro);

-- Índice para batch query de transações (FASE 1)
CREATE INDEX IF NOT EXISTS idx_transacoes_session_id_tipo 
ON public.clientes_transacoes(session_id, tipo);

-- =============================================================================
-- FASE 5: Corrigir dados existentes
-- =============================================================================

-- Executar correção de valor_pago para todas as sessões
SELECT public.fix_all_valor_pago();

-- Recalcular valor_total para todas as sessões existentes
-- Isso dispara o trigger e garante consistência
UPDATE public.clientes_sessoes cs
SET 
  valor_total = GREATEST(0,
    COALESCE(cs.valor_base_pacote, 0) +
    COALESCE(cs.valor_total_foto_extra, 0) +
    public.calculate_manual_products_total(cs.produtos_incluidos) +
    COALESCE(cs.valor_adicional, 0) -
    COALESCE(cs.desconto, 0)
  ),
  updated_at = NOW()
WHERE cs.valor_total IS DISTINCT FROM (
  COALESCE(cs.valor_base_pacote, 0) +
  COALESCE(cs.valor_total_foto_extra, 0) +
  public.calculate_manual_products_total(cs.produtos_incluidos) +
  COALESCE(cs.valor_adicional, 0) -
  COALESCE(cs.desconto, 0)
);