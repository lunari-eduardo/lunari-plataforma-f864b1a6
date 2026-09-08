-- Migration: Fix category deletion persistence & protect system items
-- Description:
-- 1. seed_user_financial_categories now checks if user already has items before seeding.
--    This prevents deleted default categories from being recreated on page reloads.
-- 2. protect_system_financial_items trigger ensures "Venda avulsa" (or any is_system item)
--    can never be deleted at the database level.

-- Step 1: Drop previous signature and recreate with p_force flag (default false)
DROP FUNCTION IF EXISTS public.seed_user_financial_categories(UUID);

CREATE OR REPLACE FUNCTION public.seed_user_financial_categories(
  p_user_id UUID,
  p_force BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o usuário já possui categorias e não é uma operação forçada, não re-insere
  IF NOT p_force AND EXISTS (SELECT 1 FROM fin_items_master WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO fin_items_master (user_id, nome, grupo_principal, ativo, is_default, is_system)
  SELECT p_user_id, c.nome, c.grupo_principal, true, true, c.is_system
  FROM fin_default_categories_catalog c
  ON CONFLICT (user_id, lower(nome), grupo_principal)
  DO UPDATE SET
    ativo = true,
    is_default = true,
    is_system = EXCLUDED.is_system;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_user_financial_categories(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_user_financial_categories(UUID, BOOLEAN) TO service_role;

-- Step 2: Trigger to protect system items (e.g. "Venda avulsa") against deletion
CREATE OR REPLACE FUNCTION public.protect_system_financial_items()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true OR (lower(trim(OLD.nome)) = 'venda avulsa' AND OLD.grupo_principal = 'Receita Operacional') THEN
    RAISE EXCEPTION 'A categoria "%" é padrão do sistema e não pode ser excluída.', OLD.nome;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_system_financial_items ON fin_items_master;
CREATE TRIGGER trg_protect_system_financial_items
  BEFORE DELETE ON fin_items_master
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_financial_items();
