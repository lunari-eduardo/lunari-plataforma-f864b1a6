/**
 * Demonstrativo financeiro — fonte única.
 *
 * Extraído de useExtratoCalculationsSupabase para permitir que qualquer tela
 * (ex.: bloco "Resumo Financeiro" do Fluxo) calcule o demonstrativo para um
 * período arbitrário (mês selecionado ou ano inteiro) sem instanciar outro
 * useExtrato — que era a causa do demonstrativo ficar preso no mês corrente.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DemonstrativoSimplificado } from '@/types/extrato';
import { RegimeContabil } from '@/hooks/useExtratoSupabase';
import { GRUPOS_DESPESAS } from '@/constants/extratoConstants';

export const DEMONSTRATIVO_VAZIO: DemonstrativoSimplificado = {
  receitas: { sessoes: 0, produtos: 0, naoOperacionais: 0, totalReceitas: 0 },
  despesas: { categorias: [], totalDespesas: 0 },
  resumoFinal: { receitaTotal: 0, despesaTotal: 0, resultadoLiquido: 0, margemLiquida: 0 },
};

export async function fetchDemonstrativo(
  dataInicio: string,
  dataFim: string,
  regime: RegimeContabil
): Promise<DemonstrativoSimplificado> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

  // ====== 1. Linhas pagas da view ======
  const { data: linhas, error: errLinhas } = await supabase
    .from('extrato_unificado')
    .select('tipo, origem, categoria, descricao, valor, status')
    .eq('user_id', user.id)
    .eq('status', 'Pago')
    .gte(dataColumn, dataInicio)
    .lte(dataColumn, dataFim);

  if (errLinhas) throw errLinhas;

  const todasLinhas = linhas || [];

  // ====== 2. RECEITAS ======
  const entradas = todasLinhas.filter((l: any) => l.tipo === 'entrada');

  const receitaSessoes = entradas
    .filter((l: any) => l.origem === 'workflow')
    .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

  const receitaProdutos = entradas
    .filter((l: any) => l.origem === 'gallery' || l.origem === 'venda_avulsa')
    .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

  const receitaNaoOperacional = entradas
    .filter((l: any) => l.origem === 'financeiro' && l.categoria === 'Receita Não Operacional')
    .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

  // ====== 3. DESPESAS AGRUPADAS ======
  const saidasFinanceiro = todasLinhas.filter(
    (l: any) => l.tipo === 'saida' && (l.origem === 'financeiro' || l.origem === 'cartao')
  );

  const categorias: Array<{
    grupo: string;
    itens: Array<{ nome: string; valor: number }>;
    total: number;
  }> = [];

  for (const grupo of GRUPOS_DESPESAS) {
    const linhasGrupo = saidasFinanceiro.filter((l: any) => l.categoria === grupo);
    if (linhasGrupo.length === 0) continue;

    const itensPorNome: Record<string, number> = {};
    linhasGrupo.forEach((l: any) => {
      const nome = l.descricao || 'Item desconhecido';
      itensPorNome[nome] = (itensPorNome[nome] || 0) + Number(l.valor);
    });

    const itens = Object.entries(itensPorNome)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
    const total = itens.reduce((sum, item) => sum + item.valor, 0);
    categorias.push({ grupo, itens, total });
  }

  // ====== 4. TAXAS DE GATEWAY (Extraídas diretamente do extrato unificado) ======
  const linhasTaxasGw = todasLinhas.filter(
    (l: any) => l.tipo === 'saida' && (l.categoria === 'Taxas de Gateway' || l.categoria === 'Despesas de Gateway')
  );

  if (linhasTaxasGw.length > 0) {
    const itensTaxasPorNome: Record<string, number> = {};
    linhasTaxasGw.forEach((l: any) => {
      const nome = l.descricao || 'Taxa de Gateway';
      itensTaxasPorNome[nome] = (itensTaxasPorNome[nome] || 0) + Number(l.valor);
    });

    const itensTaxas = Object.entries(itensTaxasPorNome)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
    const totalTaxas = itensTaxas.reduce((sum, item) => sum + item.valor, 0);

    categorias.push({
      grupo: 'Taxas de Gateway',
      itens: itensTaxas,
      total: totalTaxas,
    });
  }

  const totalReceitas = receitaSessoes + receitaProdutos + receitaNaoOperacional;
  const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);
  const resultadoLiquido = totalReceitas - totalDespesas;
  const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

  return {
    receitas: {
      sessoes: receitaSessoes,
      produtos: receitaProdutos,
      naoOperacionais: receitaNaoOperacional,
      totalReceitas,
    },
    despesas: { categorias, totalDespesas },
    resumoFinal: {
      receitaTotal: totalReceitas,
      despesaTotal: totalDespesas,
      resultadoLiquido,
      margemLiquida,
    },
  };
}

export function useDemonstrativoFinanceiro(
  dataInicio: string,
  dataFim: string,
  regime: RegimeContabil = 'caixa',
  enabled = true
) {
  const { data, isLoading } = useQuery({
    queryKey: ['demonstrativo-financeiro-v3', regime, dataInicio, dataFim],
    queryFn: () => fetchDemonstrativo(dataInicio, dataFim, regime),
    enabled: enabled && !!dataInicio && !!dataFim,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    demonstrativo: data || DEMONSTRATIVO_VAZIO,
    isLoading,
  };
}
