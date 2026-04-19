/**
 * Hook para cálculos do extrato usando queries Supabase otimizadas
 * Suporta regime contábil (caixa | competencia)
 *
 * IMPORTANTE: Cards superiores (resumo) usam query AGREGADA do período inteiro
 * (sem paginação), garantindo consistência com tabela detalhada e demonstrativo.
 * Demonstrativo lê da MESMA view `extrato_unificado`.
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LinhaExtrato, ResumoExtrato, DemonstrativoSimplificado, FiltrosExtrato } from '@/types/extrato';
import { RegimeContabil } from '@/hooks/useExtratoSupabase';
import { calcularSaldoAcumulado } from '@/utils/extratoUtils';
import { GRUPOS_DESPESAS } from '@/constants/extratoConstants';

export function useExtratoCalculationsSupabase(
  linhasFiltradas: LinhaExtrato[],
  filtros: FiltrosExtrato,
  regime: RegimeContabil = 'caixa'
) {
  // ============= RECEITA PREVISTA DE SESSÕES (apenas competência) =============
  // Saldo (valor_total - valor_pago) das sessões de workflow do período.
  const { data: receitaPrevistaSessoes = 0 } = useQuery({
    queryKey: ['extrato-receita-prevista-sessoes', regime, filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      if (regime !== 'competencia') return 0;

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('valor_total, valor_pago')
        .eq('tipo_registro', 'workflow')
        .gte('data_sessao', filtros.dataInicio)
        .lte('data_sessao', filtros.dataFim);

      if (error) throw error;

      return (data || []).reduce((acc, s: any) => {
        const total = Number(s.valor_total) || 0;
        const pago = Number(s.valor_pago) || 0;
        const saldo = total - pago;
        return acc + (saldo > 0 ? saldo : 0);
      }, 0);
    },
    staleTime: 30000,
  });

  // ============= TOTAIS AGREGADOS DO PERÍODO (independente de paginação) =============
  // Soma valores por (tipo, status) para todo o período + filtros server-side aplicados.
  // Esta query alimenta os cards superiores. Não inclui filtro de busca (texto livre).
  const { data: totaisPeriodo } = useQuery({
    queryKey: [
      'extrato-unificado-totais',
      regime,
      filtros.dataInicio,
      filtros.dataFim,
      filtros.tipo,
      filtros.origem,
      filtros.status,
    ],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

      let q = supabase
        .from('extrato_unificado')
        .select('tipo, status, valor')
        .eq('user_id', user.id)
        .gte(dataColumn, filtros.dataInicio)
        .lte(dataColumn, filtros.dataFim);

      if (filtros.tipo && filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      if (filtros.origem && filtros.origem !== 'todos') q = q.eq('origem', filtros.origem);
      if (filtros.status && filtros.status !== 'todos') q = q.eq('status', filtros.status);

      const { data, error } = await q;
      if (error) throw error;

      const acc = {
        entradasPagas: 0,
        entradasFaturadas: 0,
        entradasAgendadas: 0,
        saidasPagas: 0,
        saidasFaturadas: 0,
        saidasAgendadas: 0,
        countEntradas: 0,
      };

      (data || []).forEach((r: any) => {
        const v = Number(r.valor) || 0;
        if (r.tipo === 'entrada') {
          acc.countEntradas++;
          if (r.status === 'Pago') acc.entradasPagas += v;
          else if (r.status === 'Faturado') acc.entradasFaturadas += v;
          else if (r.status === 'Agendado') acc.entradasAgendadas += v;
        } else if (r.tipo === 'saida') {
          if (r.status === 'Pago') acc.saidasPagas += v;
          else if (r.status === 'Faturado') acc.saidasFaturadas += v;
          else if (r.status === 'Agendado') acc.saidasAgendadas += v;
        }
      });

      return acc;
    },
    staleTime: 30000,
  });

  // ============= CÁLCULO DO RESUMO (a partir de totais agregados) =============
  const resumo = useMemo((): ResumoExtrato => {
    const t = totaisPeriodo || {
      entradasPagas: 0, entradasFaturadas: 0, entradasAgendadas: 0,
      saidasPagas: 0, saidasFaturadas: 0, saidasAgendadas: 0, countEntradas: 0,
    };

    const receitaPrevista = regime === 'competencia' ? receitaPrevistaSessoes : 0;

    const totalEntradas = t.entradasPagas + t.entradasFaturadas + t.entradasAgendadas + receitaPrevista;
    const totalSaidas = t.saidasPagas + t.saidasFaturadas + t.saidasAgendadas;

    const saldoEfetivo = t.entradasPagas - t.saidasPagas;
    const saldoProjetado = t.entradasPagas + t.entradasAgendadas + t.entradasFaturadas + receitaPrevista
                          - (t.saidasPagas + t.saidasAgendadas + t.saidasFaturadas);
    const saldoPeriodo = saldoProjetado;

    const totalAReceber = t.entradasAgendadas + receitaPrevista;
    const totalAgendado = t.entradasAgendadas + t.saidasAgendadas;
    const totalPago = t.entradasPagas + t.saidasPagas;

    const ticketMedioEntradas = t.countEntradas > 0
      ? (t.entradasPagas + t.entradasAgendadas + t.entradasFaturadas) / t.countEntradas
      : 0;
    const totalGeral = totalPago + totalAReceber + totalAgendado;
    const percentualPago = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

    return {
      totalEntradas,
      entradasPagas: t.entradasPagas,
      entradasFaturadas: t.entradasFaturadas,
      entradasAgendadas: t.entradasAgendadas,
      totalSaidas,
      saidasPagas: t.saidasPagas,
      saidasFaturadas: t.saidasFaturadas,
      saidasAgendadas: t.saidasAgendadas,
      saldoPeriodo,
      saldoEfetivo,
      saldoProjetado,
      totalAReceber,
      totalAgendado,
      totalPago,
      ticketMedioEntradas,
      percentualPago
    };
  }, [totaisPeriodo, regime, receitaPrevistaSessoes]);

  // ============= LINHAS COM SALDO ACUMULADO =============
  const linhasComSaldo = useMemo(() => {
    return calcularSaldoAcumulado(linhasFiltradas);
  }, [linhasFiltradas]);

  // ============= DEMONSTRATIVO LENDO DA VIEW extrato_unificado =============
  const { data: demonstrativoData } = useQuery({
    queryKey: ['demonstrativo-financeiro-v3', regime, filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

      // ====== 1. Linhas pagas da view ======
      const { data: linhas, error: errLinhas } = await supabase
        .from('extrato_unificado')
        .select('tipo, origem, categoria, descricao, valor, status')
        .eq('user_id', user.id)
        .eq('status', 'Pago')
        .gte(dataColumn, filtros.dataInicio)
        .lte(dataColumn, filtros.dataFim);

      if (errLinhas) throw errLinhas;

      const todasLinhas = linhas || [];

      // ====== 2. RECEITAS ======
      // categoria na view = grupo_principal (ex: "Receita Não Operacional")
      // descricao na view = nome do item (ex: "Aluguel")
      const entradas = todasLinhas.filter((l: any) => l.tipo === 'entrada');

      const receitaSessoes = entradas
        .filter((l: any) => l.origem === 'workflow')
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      const receitaProdutos = entradas
        .filter((l: any) => l.origem === 'gallery')
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      const receitaNaoOperacional = entradas
        .filter((l: any) => l.origem === 'financeiro' && l.categoria === 'Receita Não Operacional')
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      // ====== 3. DESPESAS AGRUPADAS ======
      // Agrupa direto pela coluna `categoria` (que já é o grupo_principal).
      const saidasFinanceiro = todasLinhas.filter(
        (l: any) => l.tipo === 'saida' && l.origem === 'financeiro'
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

      // ====== 4. TAXAS DE GATEWAY ======
      let taxasQuery = supabase
        .from('clientes_transacoes')
        .select(`
          taxa_gateway,
          taxa_antecipacao,
          data_transacao,
          clientes_sessoes!fk_transacoes_session_id (data_sessao)
        `)
        .eq('user_id', user.id)
        .eq('tipo', 'pagamento');

      if (regime === 'caixa') {
        taxasQuery = taxasQuery
          .gte('data_transacao', filtros.dataInicio)
          .lte('data_transacao', filtros.dataFim);
      }

      const { data: taxasRaw, error: errorTaxas } = await taxasQuery;
      if (errorTaxas) throw errorTaxas;

      const taxasFiltradas = (taxasRaw || []).filter((t: any) => {
        if (regime === 'caixa') return true;
        const dataRef = t.clientes_sessoes?.data_sessao || t.data_transacao;
        return dataRef >= filtros.dataInicio && dataRef <= filtros.dataFim;
      });

      const totalTaxasGw = taxasFiltradas.reduce(
        (sum: number, t: any) => sum + Number(t.taxa_gateway || 0), 0);
      const totalTaxasAnt = taxasFiltradas.reduce(
        (sum: number, t: any) => sum + Number(t.taxa_antecipacao || 0), 0);

      if (totalTaxasGw + totalTaxasAnt > 0) {
        const itensTaxas: Array<{ nome: string; valor: number }> = [];
        if (totalTaxasGw > 0) itensTaxas.push({ nome: 'Taxa Gateway', valor: totalTaxasGw });
        if (totalTaxasAnt > 0) itensTaxas.push({ nome: 'Taxa Antecipação', valor: totalTaxasAnt });

        categorias.push({
          grupo: 'Taxas de Gateway',
          itens: itensTaxas,
          total: totalTaxasGw + totalTaxasAnt
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
          totalReceitas
        },
        despesas: {
          categorias,
          totalDespesas
        },
        resumoFinal: {
          receitaTotal: totalReceitas,
          despesaTotal: totalDespesas,
          resultadoLiquido,
          margemLiquida
        }
      };
    },
    staleTime: 30000,
  });

  const demonstrativo = useMemo((): DemonstrativoSimplificado => {
    return demonstrativoData || {
      receitas: { sessoes: 0, produtos: 0, naoOperacionais: 0, totalReceitas: 0 },
      despesas: { categorias: [], totalDespesas: 0 },
      resumoFinal: { receitaTotal: 0, despesaTotal: 0, resultadoLiquido: 0, margemLiquida: 0 }
    };
  }, [demonstrativoData]);

  const calcularDemonstrativoParaPeriodo = useCallback((
    _dataInicio: string,
    _dataFim: string
  ): DemonstrativoSimplificado => {
    return demonstrativo;
  }, [demonstrativo]);

  return {
    resumo,
    linhasComSaldo,
    demonstrativo,
    calcularDemonstrativoParaPeriodo
  };
}
