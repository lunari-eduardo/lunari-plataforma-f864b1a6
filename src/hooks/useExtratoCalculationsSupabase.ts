/**
 * Hook para cálculos do extrato usando queries Supabase otimizadas
 * Suporta regime contábil (caixa | competencia)
 *
 * IMPORTANTE: O demonstrativo lê da MESMA view `extrato_unificado` que alimenta
 * os cards e a tabela detalhada. Isso garante consistência absoluta entre as
 * três visualizações (sem JOINs órfãos / fallbacks divergentes).
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
  // Não conta o que já foi pago (esse já aparece como entradasPagas via view).
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

  // ============= CÁLCULO DO RESUMO =============
  const resumo = useMemo((): ResumoExtrato => {
    const entradas = linhasFiltradas.filter(l => l.tipo === 'entrada');
    const saidas = linhasFiltradas.filter(l => l.tipo === 'saida');

    const entradasPagas = entradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const entradasFaturadas = entradas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const entradasAgendadas = entradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);

    const saidasPagas = saidas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const saidasFaturadas = saidas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const saidasAgendadas = saidas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);

    // Receita prevista (saldo de sessões) só conta no regime competência
    const receitaPrevista = regime === 'competencia' ? receitaPrevistaSessoes : 0;

    const totalEntradas = entradasPagas + entradasFaturadas + entradasAgendadas + receitaPrevista;
    const totalSaidas = saidasPagas + saidasFaturadas + saidasAgendadas;

    const saldoEfetivo = entradasPagas - saidasPagas;
    // Saldo projetado: pagas + agendadas + previsto a receber - despesas (pagas + agendadas + faturadas)
    const saldoProjetado = entradasPagas + entradasAgendadas + entradasFaturadas + receitaPrevista
                          - (saidasPagas + saidasAgendadas + saidasFaturadas);
    const saldoPeriodo = saldoProjetado;

    // A Receber: entradas agendadas + saldo de sessões (no competência)
    const totalAReceber = entradasAgendadas + receitaPrevista;
    const totalAgendado = linhasFiltradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalPago = linhasFiltradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);

    const ticketMedioEntradas = entradas.length > 0 ? (entradasPagas + entradasAgendadas + entradasFaturadas) / entradas.length : 0;
    const totalGeral = totalPago + totalAReceber + totalAgendado;
    const percentualPago = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

    return {
      totalEntradas,
      entradasPagas,
      entradasFaturadas,
      entradasAgendadas,
      totalSaidas,
      saidasPagas,
      saidasFaturadas,
      saidasAgendadas,
      saldoPeriodo,
      saldoEfetivo,
      saldoProjetado,
      totalAReceber,
      totalAgendado,
      totalPago,
      ticketMedioEntradas,
      percentualPago
    };
  }, [linhasFiltradas, regime, receitaPrevistaSessoes]);

  // ============= LINHAS COM SALDO ACUMULADO =============
  const linhasComSaldo = useMemo(() => {
    return calcularSaldoAcumulado(linhasFiltradas);
  }, [linhasFiltradas]);

  // ============= DEMONSTRATIVO LENDO DA VIEW extrato_unificado =============
  const { data: demonstrativoData } = useQuery({
    queryKey: ['demonstrativo-financeiro-v2', regime, filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

      // ====== 1. Linhas pagas da view ======
      // Busca todas as entradas/saídas com status Pago no período (regime correto)
      const { data: linhas, error: errLinhas } = await supabase
        .from('extrato_unificado')
        .select('tipo, origem, categoria, valor, status')
        .eq('user_id', user.id)
        .eq('status', 'Pago')
        .gte(dataColumn, filtros.dataInicio)
        .lte(dataColumn, filtros.dataFim);

      if (errLinhas) throw errLinhas;

      const todasLinhas = linhas || [];

      // ====== 2. Mapear item->grupo via fin_items_master ======
      const { data: itemsMaster, error: errItems } = await supabase
        .from('fin_items_master')
        .select('nome, grupo_principal')
        .eq('user_id', user.id);

      if (errItems) throw errItems;

      const itemToGrupo = new Map<string, string>();
      (itemsMaster || []).forEach((it: any) => {
        itemToGrupo.set(it.nome, it.grupo_principal);
      });

      // ====== 3. RECEITAS ======
      // Sessões = origem 'workflow' tipo 'entrada'
      // Produtos (gallery) = origem 'gallery' tipo 'entrada'
      // Não operacionais = origem 'financeiro' tipo 'entrada' E grupo='Receita Não Operacional'
      const entradas = todasLinhas.filter((l: any) => l.tipo === 'entrada');

      const receitaSessoes = entradas
        .filter((l: any) => l.origem === 'workflow')
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      const receitaProdutos = entradas
        .filter((l: any) => l.origem === 'gallery')
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      const receitaNaoOperacional = entradas
        .filter((l: any) => {
          if (l.origem !== 'financeiro') return false;
          const grupo = itemToGrupo.get(l.categoria || '');
          return grupo === 'Receita Não Operacional';
        })
        .reduce((sum: number, l: any) => sum + Number(l.valor), 0);

      // ====== 4. DESPESAS AGRUPADAS ======
      const saidasFinanceiro = todasLinhas.filter(
        (l: any) => l.tipo === 'saida' && l.origem === 'financeiro'
      );

      const categorias: Array<{
        grupo: string;
        itens: Array<{ nome: string; valor: number }>;
        total: number;
      }> = [];

      for (const grupo of GRUPOS_DESPESAS) {
        const linhasGrupo = saidasFinanceiro.filter(
          (l: any) => itemToGrupo.get(l.categoria || '') === grupo
        );

        if (linhasGrupo.length === 0) continue;

        const itensPorNome: Record<string, number> = {};
        linhasGrupo.forEach((l: any) => {
          const nome = l.categoria || 'Item desconhecido';
          itensPorNome[nome] = (itensPorNome[nome] || 0) + Number(l.valor);
        });

        const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({ nome, valor }));
        const total = itens.reduce((sum, item) => sum + item.valor, 0);
        categorias.push({ grupo, itens, total });
      }

      // ====== 5. TAXAS DE GATEWAY ======
      // Lê direto de clientes_transacoes (view não expõe taxas)
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
      receitas: {
        sessoes: 0,
        produtos: 0,
        naoOperacionais: 0,
        totalReceitas: 0
      },
      despesas: {
        categorias: [],
        totalDespesas: 0
      },
      resumoFinal: {
        receitaTotal: 0,
        despesaTotal: 0,
        resultadoLiquido: 0,
        margemLiquida: 0
      }
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
