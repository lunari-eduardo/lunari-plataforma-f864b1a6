
-- 1) Add column requires_category
ALTER TABLE public.fin_groups
  ADD COLUMN IF NOT EXISTS requires_category boolean NOT NULL DEFAULT true;

-- 2) Rename "Pessoal" to "Equipe"
UPDATE public.fin_groups SET label = 'Equipe' WHERE code = 'pessoal';

-- 3) Remove obsolete groups (no live data depends on them — confirmed in audit)
DELETE FROM public.fin_groups WHERE code IN ('taxas', 'emprestimo_pessoal', 'outros_op', 'juros_recebidos');

-- 4) Refine: Rendimentos cobre toda receita financeira
UPDATE public.fin_groups SET label = 'Rendimentos Financeiros' WHERE code = 'rendimentos';

-- 5) Insert new Receita Não Operacional groups (under receita_financeira nature for KPI grouping)
INSERT INTO public.fin_groups (code, nature_code, label, icon, ordering) VALUES
  ('locacao_espaco', 'receita_financeira', 'Locação de Espaço/Equipamentos', 'key',    52),
  ('venda_ativos',   'receita_financeira', 'Venda de Ativos',                 'tag',    54),
  ('indenizacoes',   'receita_financeira', 'Indenizações e Reembolsos',       'shield', 56),
  ('outros_extras',  'receita_financeira', 'Outros (Extras)',                 'more-horizontal', 58)
ON CONFLICT (code) DO NOTHING;

-- 6) Mark final groups (no category required)
UPDATE public.fin_groups SET requires_category = false
WHERE code IN (
  -- despesa operacional finais
  'estrutura','transporte','alimentacao','servicos','pessoal',
  -- investimentos
  'equipamentos','acervo','cenarios','moveis','imoveis',
  -- receita extras
  'rendimentos','locacao_espaco','venda_ativos','indenizacoes','outros_extras',
  -- neutros / financiamentos / aplicações
  'entre_contas','capital_giro','financ_equipamento','financ_veiculo','financ_imovel',
  'aplic_cdb','aplic_tesouro','aplic_outros',
  -- pro-labore / distribuição
  'pro_labore_grp','distribuicao'
);

-- 7) Garantir que Marketing, Softwares e Tributos exigem categoria
UPDATE public.fin_groups SET requires_category = true
WHERE code IN ('marketing','softwares','tributos','ensaios','eventos','produtos','cursos');
