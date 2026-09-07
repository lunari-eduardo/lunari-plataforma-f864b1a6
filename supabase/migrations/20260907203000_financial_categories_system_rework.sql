-- ==============================================================================
-- Migration: 20260907203000_financial_categories_system_rework.sql
-- Objetivo:
-- 1. Criar catálogo template estático de categorias financeiras padrão do sistema
-- 2. Criar função idempotente para provisionar categorias para cada novo usuário
-- 3. Atualizar trigger handle_new_user_profile para chamar o provisionamento
-- 4. Migrar transações existentes de categorias descontinuadas com segurança
-- 5. Excluir categorias indevidas ('Ajuste de saldo', 'Distribuição de Lucros' em gastos, 'Cursos' em investimentos, etc.)
-- 6. Atualizar finance_apply_saldo_ajuste e remover finance_ensure_ajuste_items
-- 7. Provisionar as 27 categorias oficiais para todos os usuários existentes
-- ==============================================================================

-- 1. TABELA DE CATÁLOGO TEMPLATE DO SISTEMA
CREATE TABLE IF NOT EXISTS public.fin_default_categories_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  grupo_principal TEXT NOT NULL CHECK (grupo_principal IN (
    'Despesa Fixa', 
    'Despesa Variável', 
    'Investimento', 
    'Receita Não Operacional',
    'Receita Operacional'
  )),
  is_system BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fin_default_categories_catalog_uniq 
  ON public.fin_default_categories_catalog (lower(nome), grupo_principal);

ALTER TABLE public.fin_default_categories_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view default catalog" ON public.fin_default_categories_catalog;
CREATE POLICY "Anyone authenticated can view default catalog"
  ON public.fin_default_categories_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. INSERIR EXCLUSIVAMENTE AS 27 CATEGORIAS PADRÃO OFICIAIS NO CATÁLOGO
INSERT INTO public.fin_default_categories_catalog (nome, grupo_principal, is_system, ordem)
VALUES
  -- 1. Receitas de vendas (Receita Operacional) - 1 categoria
  ('Venda avulsa', 'Receita Operacional', true, 10),

  -- 2. Outras receitas (Receita Não Operacional) - 6 categorias
  ('Aportes', 'Receita Não Operacional', false, 10),
  ('Reembolsos', 'Receita Não Operacional', false, 20),
  ('Juros e rendimentos', 'Receita Não Operacional', false, 30),
  ('Locação de espaço/equipamento', 'Receita Não Operacional', false, 40),
  ('Venda de equipamento', 'Receita Não Operacional', false, 50),
  ('Outras receitas', 'Receita Não Operacional', false, 60),

  -- 3. Despesas fixas (Despesa Fixa) - 8 categorias
  ('Aluguel', 'Despesa Fixa', false, 10),
  ('Água', 'Despesa Fixa', false, 20),
  ('Energia', 'Despesa Fixa', false, 30),
  ('Internet', 'Despesa Fixa', false, 40),
  ('Software', 'Despesa Fixa', false, 50),
  ('Colaboradores', 'Despesa Fixa', false, 60),
  ('Pró-labore', 'Despesa Fixa', false, 70),
  ('Contabilidade', 'Despesa Fixa', false, 80),

  -- 4. Gastos do dia a dia (Despesa Variável) - 9 categorias
  ('Marketing', 'Despesa Variável', false, 10),
  ('Combustível e transporte', 'Despesa Variável', false, 20),
  ('Materiais e insumos', 'Despesa Variável', false, 30),
  ('Fornecedores e serviços', 'Despesa Variável', false, 40),
  ('Impostos', 'Despesa Variável', false, 50),
  ('Manutenção', 'Despesa Variável', false, 60),
  ('Taxas e tarifas', 'Despesa Variável', false, 70),
  ('Cursos e treinamentos', 'Despesa Variável', false, 80),
  ('Outras despesas', 'Despesa Variável', false, 90),

  -- 5. Investimentos (Investimento) - 3 categorias
  ('Equipamentos', 'Investimento', false, 10),
  ('Móveis e estrutura', 'Investimento', false, 20),
  ('Acervo e cenários', 'Investimento', false, 30)
ON CONFLICT (lower(nome), grupo_principal) 
DO UPDATE SET 
  is_system = EXCLUDED.is_system,
  ordem = EXCLUDED.ordem;

-- 3. FUNÇÃO DE PROVISIONAMENTO IDEMPOTENTE INDIVIDUAL POR USUÁRIO
CREATE OR REPLACE FUNCTION public.seed_user_financial_categories(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.fin_items_master (user_id, nome, grupo_principal, ativo, is_default, is_system)
  SELECT 
    p_user_id,
    cat.nome,
    cat.grupo_principal,
    true,
    true,
    cat.is_system
  FROM public.fin_default_categories_catalog cat
  ON CONFLICT (user_id, lower(nome), grupo_principal) 
  DO UPDATE SET
    is_default = true,
    is_system = EXCLUDED.is_system,
    ativo = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_user_financial_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_user_financial_categories(UUID) TO service_role;

-- 4. ATUALIZAR TRIGGER handle_new_user_profile PARA PROVISIONAR AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_authorized BOOLEAN;
  v_fingerprint TEXT;
  v_is_duplicate BOOLEAN := false;
BEGIN
  -- Extract fingerprint from user metadata (set during signup)
  v_fingerprint := NEW.raw_user_meta_data->>'device_fingerprint';
  
  -- Check if fingerprint already exists for another user
  IF v_fingerprint IS NOT NULL AND v_fingerprint != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM account_fingerprints
      WHERE device_fingerprint = v_fingerprint
        AND user_id != NEW.id
    ) INTO v_is_duplicate;
  END IF;

  -- STEP 1: Create profile
  INSERT INTO public.profiles (user_id, email, nome, avatar_url, is_onboarding_complete, suspected_duplicate)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    FALSE,
    v_is_duplicate
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(profiles.nome, ''), EXCLUDED.nome),
    avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), EXCLUDED.avatar_url),
    suspected_duplicate = CASE WHEN EXCLUDED.suspected_duplicate THEN true ELSE profiles.suspected_duplicate END,
    updated_at = now();
  
  -- STEP 2: Create photographer account
  IF v_is_duplicate THEN
    INSERT INTO public.photographer_accounts (user_id, account_type, account_status, photo_credits, free_transfer_bytes)
    VALUES (NEW.id, 'gallery_solo', 'active', 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.photographer_accounts (user_id, account_type, account_status, photo_credits, free_transfer_bytes)
    VALUES (NEW.id, 'gallery_solo', 'active', 500, 536870912)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  -- Record fingerprint if available
  IF v_fingerprint IS NOT NULL AND v_fingerprint != '' THEN
    INSERT INTO account_fingerprints (user_id, device_fingerprint, event_type)
    VALUES (NEW.id, v_fingerprint, 'signup');
  END IF;

  -- STEP 3: Provisionar categorias financeiras padrão individuais para o novo usuário
  PERFORM public.seed_user_financial_categories(NEW.id);

  -- STEP 4: Check if user is admin
  IF NEW.email = 'lisediehlfotos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE LOG 'Admin role assigned to: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- STEP 5: Check if email is authorized
  SELECT EXISTS(SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) INTO v_is_authorized;
  IF v_is_authorized THEN
    RAISE LOG 'Authorized email registered (no trial needed): %', NEW.email;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Gallery signup complete for: %', NEW.email;
  RETURN NEW;
END;
$function$;

-- 5. MIGRAR COM SEGURANÇA TRANSAÇÕES EXISTENTES E PRESERVAR DADOS HISTÓRICOS
DO $$
DECLARE
  r RECORD;
  v_target_id UUID;
BEGIN
  -- Para cada usuário que possui transações:
  FOR r IN (SELECT DISTINCT user_id FROM public.fin_transactions) LOOP
    -- Garante que o usuário já tenha as categorias padrão oficiais disponíveis
    PERFORM public.seed_user_financial_categories(r.user_id);

    -- 5.1 Migrar transações de 'Adobe' e 'Canva' para 'Software'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Software' AND grupo_principal = 'Despesa Fixa' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) IN ('adobe', 'canva') AND grupo_principal = 'Despesa Fixa'
        );
    END IF;

    -- 5.2 Migrar transações de 'Colaborador' para 'Colaboradores'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Colaboradores' AND grupo_principal = 'Despesa Fixa' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) = 'colaborador' AND grupo_principal = 'Despesa Fixa'
        );
    END IF;

    -- 5.3 Migrar transações de 'Energia Elétrica' para 'Energia'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Energia' AND grupo_principal = 'Despesa Fixa' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) = 'energia elétrica' AND grupo_principal = 'Despesa Fixa'
        );
    END IF;

    -- 5.4 Migrar transações de 'DAS' para 'Impostos'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Impostos' AND grupo_principal = 'Despesa Variável' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) = 'das'
        );
    END IF;

    -- 5.5 Migrar transações de 'Combustível' para 'Combustível e transporte'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Combustível e transporte' AND grupo_principal = 'Despesa Variável' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) = 'combustível' AND grupo_principal = 'Despesa Variável'
        );
    END IF;

    -- 5.6 Migrar transações de 'Acervo/Cenário' para 'Acervo e cenários'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Acervo e cenários' AND grupo_principal = 'Investimento' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) IN ('acervo/cenário', 'acervo / cenário') AND grupo_principal = 'Investimento'
        );
    END IF;

    -- 5.7 Migrar transações de 'Vendas de Equipamentos' para 'Venda de equipamento'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Venda de equipamento' AND grupo_principal = 'Receita Não Operacional' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) IN ('vendas de equipamentos', 'venda de equipamento') AND grupo_principal = 'Receita Não Operacional' AND id != v_target_id
        );
    END IF;

    -- 5.8 Migrar transações de 'Receita Extra' e 'Ajuste de saldo (entrada)' para 'Outras receitas'
    SELECT id INTO v_target_id FROM public.fin_items_master WHERE user_id = r.user_id AND nome = 'Outras receitas' AND grupo_principal = 'Receita Não Operacional' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE public.fin_transactions ft
      SET item_id = v_target_id
      WHERE ft.user_id = r.user_id
        AND ft.item_id IN (
          SELECT id FROM public.fin_items_master 
          WHERE user_id = r.user_id AND lower(nome) IN ('receita extra', 'ajuste de saldo (entrada)')
        );
    END IF;
  END LOOP;
END;
$$;

-- 6. REMOVER CATEGORIAS INDEVIDAS E OBSOLETAS DO SISTEMA
-- 6.1 Remover categoricamente 'Ajuste de saldo (entrada)' e 'Ajuste de saldo (saída)'
DELETE FROM public.fin_items_master 
WHERE lower(nome) IN ('ajuste de saldo (entrada)', 'ajuste de saldo (saída)');

-- 6.2 Remover 'Distribuição de Lucros' em Despesa Variável (Gastos do dia a dia)
DELETE FROM public.fin_items_master 
WHERE lower(nome) = 'distribuição de lucros' AND grupo_principal = 'Despesa Variável';

-- 6.3 Remover 'Cursos e Treinamentos' em Investimento (deve existir somente em Gastos do dia a dia)
DELETE FROM public.fin_items_master 
WHERE lower(nome) IN ('cursos e treinamentos', 'cursos e treinamento') AND grupo_principal = 'Investimento';

-- 6.4 Limpar categorias padrão antigas descontinuadas que NÃO possuem nenhuma transação nem blueprint
DELETE FROM public.fin_items_master fim
WHERE fim.is_default = true
  AND lower(fim.nome) IN (
    'das', 'adobe', 'canva', 'assinatura', 'fornecedor 1', 'fornecedor 2', 
    'alimentação', 'receita extra', 'vendas de equipamentos', 'acervo/cenário',
    'acervo / cenário', 'produtos', 'vendas', 'colaborador', 'energia elétrica', 'combustível'
  )
  AND NOT EXISTS (SELECT 1 FROM public.fin_transactions ft WHERE ft.item_id = fim.id)
  AND NOT EXISTS (SELECT 1 FROM public.fin_recurring_blueprints frb WHERE frb.item_id = fim.id);

-- 7. ATUALIZAR finance_apply_saldo_ajuste E REMOVER finance_ensure_ajuste_items
DROP FUNCTION IF EXISTS public.finance_ensure_ajuste_items();

CREATE OR REPLACE FUNCTION public.finance_apply_saldo_ajuste(
  _data date,
  _saldo_desejado numeric,
  _observacoes text DEFAULT NULL
)
RETURNS TABLE (acao text, valor_delta numeric, transaction_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _atual numeric;
  _delta numeric;
  _item_in uuid;
  _item_out uuid;
  _new_id uuid;
  _obs text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _data IS NULL THEN RAISE EXCEPTION 'data obrigatória'; END IF;
  IF _saldo_desejado IS NULL THEN RAISE EXCEPTION 'saldo desejado obrigatório'; END IF;

  _atual := public.finance_get_saldo_ate(_data);
  _delta := round((_saldo_desejado - _atual)::numeric, 2);

  IF abs(_delta) < 0.01 THEN
    RETURN QUERY SELECT 'noop'::text, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Busca a categoria 'Outras receitas' (se delta > 0) ou 'Outras despesas' (se delta < 0) do próprio usuário
  SELECT id INTO _item_in
    FROM public.fin_items_master
   WHERE user_id = _uid
     AND nome = 'Outras receitas'
     AND grupo_principal = 'Receita Não Operacional'
   LIMIT 1;

  IF _item_in IS NULL THEN
    INSERT INTO public.fin_items_master (user_id, nome, grupo_principal, ativo, is_default)
    VALUES (_uid, 'Outras receitas', 'Receita Não Operacional', true, true)
    RETURNING id INTO _item_in;
  END IF;

  SELECT id INTO _item_out
    FROM public.fin_items_master
   WHERE user_id = _uid
     AND nome = 'Outras despesas'
     AND grupo_principal = 'Despesa Variável'
   LIMIT 1;

  IF _item_out IS NULL THEN
    INSERT INTO public.fin_items_master (user_id, nome, grupo_principal, ativo, is_default)
    VALUES (_uid, 'Outras despesas', 'Despesa Variável', true, true)
    RETURNING id INTO _item_out;
  END IF;

  _obs := '[Ajuste de saldo] ' || COALESCE(NULLIF(_observacoes, ''), 'Conciliação com saldo em conta');

  IF _delta > 0 THEN
    INSERT INTO public.fin_transactions (user_id, item_id, valor, data_vencimento, status, observacoes)
    VALUES (_uid, _item_in, _delta, _data, 'Pago', _obs)
    RETURNING id INTO _new_id;
    RETURN QUERY SELECT 'entrada'::text, _delta, _new_id;
  ELSE
    INSERT INTO public.fin_transactions (user_id, item_id, valor, data_vencimento, status, observacoes)
    VALUES (_uid, _item_out, abs(_delta), _data, 'Pago', _obs)
    RETURNING id INTO _new_id;
    RETURN QUERY SELECT 'saida'::text, _delta, _new_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.finance_apply_saldo_ajuste(date, numeric, text) TO authenticated;

-- 8. PROVISIONAR AS 27 CATEGORIAS OFICIAIS PARA TODOS OS USUÁRIOS EXISTENTES
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN (SELECT id FROM auth.users) LOOP
    PERFORM public.seed_user_financial_categories(u.id);
  END LOOP;
END;
$$;
