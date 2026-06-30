
-- =========================================================
-- Onda A — Fundação: Natureza → Grupo → Categoria
-- =========================================================

-- 1) fin_natures (catálogo interno, seed-only)
CREATE TABLE IF NOT EXISTS public.fin_natures (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  sign        text NOT NULL CHECK (sign IN ('credit','debit','neutral')),
  affects_pnl boolean NOT NULL DEFAULT true,
  ordering    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fin_natures TO anon, authenticated;
GRANT ALL    ON public.fin_natures TO service_role;

ALTER TABLE public.fin_natures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_natures_read_all" ON public.fin_natures;
CREATE POLICY "fin_natures_read_all"
  ON public.fin_natures FOR SELECT
  USING (true);

-- 2) fin_groups (catálogo visível, seed-only)
CREATE TABLE IF NOT EXISTS public.fin_groups (
  code        text PRIMARY KEY,
  nature_code text NOT NULL REFERENCES public.fin_natures(code) ON UPDATE CASCADE,
  label       text NOT NULL,
  icon        text,
  ordering    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_groups_nature_idx ON public.fin_groups(nature_code);

GRANT SELECT ON public.fin_groups TO anon, authenticated;
GRANT ALL    ON public.fin_groups TO service_role;

ALTER TABLE public.fin_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_groups_read_all" ON public.fin_groups;
CREATE POLICY "fin_groups_read_all"
  ON public.fin_groups FOR SELECT
  USING (true);

-- 3) Evolução de fin_items_master (categorias)
ALTER TABLE public.fin_items_master
  ADD COLUMN IF NOT EXISTS group_code   text REFERENCES public.fin_groups(code) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz;

CREATE INDEX IF NOT EXISTS fin_items_master_group_code_idx
  ON public.fin_items_master(group_code);

CREATE INDEX IF NOT EXISTS fin_items_master_archived_at_idx
  ON public.fin_items_master(archived_at);

-- =========================================================
-- 4) Seed — Naturezas
-- =========================================================
INSERT INTO public.fin_natures (code, label, sign, affects_pnl, ordering) VALUES
  ('receita_operacional',    'Receita Operacional',    'credit',  true,  10),
  ('receita_financeira',     'Receita Financeira',     'credit',  true,  20),
  ('despesa_operacional',    'Despesa Operacional',    'debit',   true,  30),
  ('investimento_ativos',    'Investimento em Ativos', 'debit',   true,  40),
  ('impostos',               'Impostos',               'debit',   true,  50),
  ('pro_labore',             'Pró-labore',             'debit',   true,  60),
  ('distribuicao_lucros',    'Distribuição de Lucros', 'debit',   true,  70),
  ('transferencia',          'Transferência',          'neutral', false, 80),
  ('emprestimo',             'Empréstimo',             'neutral', false, 90),
  ('financiamento',          'Financiamento',          'debit',   true, 100),
  ('aplicacao_financeira',   'Aplicação Financeira',   'neutral', false, 110)
ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label,
      sign = EXCLUDED.sign,
      affects_pnl = EXCLUDED.affects_pnl,
      ordering = EXCLUDED.ordering;

-- =========================================================
-- 5) Seed — Grupos
-- =========================================================
INSERT INTO public.fin_groups (code, nature_code, label, icon, ordering) VALUES
  -- Receita Operacional
  ('ensaios',               'receita_operacional', 'Ensaios',                'camera',     10),
  ('eventos',               'receita_operacional', 'Eventos',                'sparkles',   20),
  ('produtos',              'receita_operacional', 'Vendas de Produtos',     'package',    30),
  ('cursos',                'receita_operacional', 'Cursos e Mentorias',     'graduation-cap', 40),

  -- Receita Financeira
  ('rendimentos',           'receita_financeira',  'Rendimentos',            'trending-up', 50),
  ('juros_recebidos',       'receita_financeira',  'Juros Recebidos',        'percent',     60),

  -- Despesa Operacional
  ('marketing',             'despesa_operacional', 'Marketing',              'megaphone',   70),
  ('softwares',             'despesa_operacional', 'Softwares',              'monitor',     80),
  ('estrutura',             'despesa_operacional', 'Estrutura',              'building',    90),
  ('transporte',            'despesa_operacional', 'Transporte',             'car',        100),
  ('servicos',              'despesa_operacional', 'Serviços',               'wrench',     110),
  ('pessoal',               'despesa_operacional', 'Pessoal',                'users',      120),
  ('alimentacao',           'despesa_operacional', 'Alimentação',            'utensils',   130),
  ('outros_op',             'despesa_operacional', 'Outros',                 'more-horizontal', 140),

  -- Investimento em Ativos
  ('equipamentos',          'investimento_ativos', 'Equipamentos',           'camera',     150),
  ('acervo',                'investimento_ativos', 'Acervo',                 'image',      160),
  ('cenarios',              'investimento_ativos', 'Cenários',               'theater',    170),
  ('moveis',                'investimento_ativos', 'Móveis',                 'sofa',       180),
  ('imoveis',               'investimento_ativos', 'Imóveis',                'home',       190),

  -- Impostos
  ('tributos',              'impostos',            'Tributos',               'landmark',   200),
  ('taxas',                 'impostos',            'Taxas',                  'receipt',    210),

  -- Pró-labore / Distribuição
  ('pro_labore_grp',        'pro_labore',          'Pró-labore',             'user-check', 220),
  ('distribuicao',          'distribuicao_lucros', 'Distribuição de Lucros', 'pie-chart',  230),

  -- Transferência
  ('entre_contas',          'transferencia',       'Entre Contas',           'arrow-left-right', 240),

  -- Empréstimo / Financiamento
  ('capital_giro',          'emprestimo',          'Capital de Giro',        'banknote',   250),
  ('emprestimo_pessoal',    'emprestimo',          'Pessoal',                'hand-coins', 260),
  ('financ_equipamento',    'financiamento',       'Equipamento',            'camera',     270),
  ('financ_veiculo',        'financiamento',       'Veículo',                'car',        280),
  ('financ_imovel',         'financiamento',       'Imóvel',                 'home',       290),

  -- Aplicação Financeira
  ('aplic_cdb',             'aplicacao_financeira','CDB',                    'piggy-bank', 300),
  ('aplic_tesouro',         'aplicacao_financeira','Tesouro',                'landmark',   310),
  ('aplic_outros',          'aplicacao_financeira','Outros',                 'wallet',     320)
ON CONFLICT (code) DO UPDATE
  SET nature_code = EXCLUDED.nature_code,
      label = EXCLUDED.label,
      icon = EXCLUDED.icon,
      ordering = EXCLUDED.ordering;
