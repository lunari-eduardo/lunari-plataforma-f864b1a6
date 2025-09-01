/**
 * Hook para cálculos do extrato (resumo e demonstrativo)
 */

import { useMemo, useCallback } from 'react';
import { LinhaExtrato, ResumoExtrato, DemonstrativoSimplificado, FiltrosExtrato } from '@/types/extrato';
import { calcularSaldoAcumulado, normalizeDate, getPagamentoEffectiveDate, getTransacaoEffectiveDate } from '@/utils/extratoUtils';
import { GRUPOS_DESPESAS } from '@/constants/extratoConstants';

interface ExtratoCalculationsData {
  transacoesFinanceiras: any[];
  pagamentosWorkflow: any[];
  itensFinanceiros: any[];
}

export function useExtratoCalculations(
  linhasFiltradas: LinhaExtrato[],
  filtros: FiltrosExtrato,
  data: ExtratoCalculationsData
) {
  // ============= CÁLCULO DO RESUMO =============
  const resumo = useMemo((): ResumoExtrato => {
    const entradas = linhasFiltradas.filter(l => l.tipo === 'entrada');
    const saidas = linhasFiltradas.filter(l => l.tipo === 'saida');
    
    // ENTRADAS por status
    const entradasPagas = entradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const entradasFaturadas = entradas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const entradasAgendadas = entradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalEntradas = entradasPagas + entradasFaturadas + entradasAgendadas;
    
    // SAÍDAS por status (CORREÇÃO: separar efetivas de futuras)
    const saidasPagas = saidas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const saidasFaturadas = saidas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const saidasAgendadas = saidas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalSaidas = saidasPagas + saidasFaturadas + saidasAgendadas;
    
    // SALDOS - separando efetivo de projetado
    const saldoEfetivo = entradasPagas - saidasPagas; // apenas valores realmente movimentados
    const saldoProjetado = totalEntradas - totalSaidas; // incluindo futuros
    const saldoPeriodo = saldoProjetado; // manter compatibilidade
    
    // MÉTRICAS AUXILIARES
    const totalAReceber = entradasAgendadas; // Apenas entradas agendadas (não incluir saídas)
    const totalAgendado = linhasFiltradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalPago = linhasFiltradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    
    const ticketMedioEntradas = entradas.length > 0 ? totalEntradas / entradas.length : 0;
    const totalGeral = totalPago + totalAReceber + totalAgendado;
    const percentualPago = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

    return {
      // Entradas
      totalEntradas,
      entradasPagas,
      entradasFaturadas,
      entradasAgendadas,
      
      // Saídas
      totalSaidas,
      saidasPagas,
      saidasFaturadas,
      saidasAgendadas,
      
      // Saldos
      saldoPeriodo,
      saldoEfetivo,
      saldoProjetado,
      
      // Métricas auxiliares
      totalAReceber,
      totalAgendado,
      totalPago,
      ticketMedioEntradas,
      percentualPago
    };
  }, [linhasFiltradas]);

  // ============= LINHAS COM SALDO ACUMULADO =============
  const linhasComSaldo = useMemo(() => {
    return calcularSaldoAcumulado(linhasFiltradas);
  }, [linhasFiltradas]);

  // ============= DEMONSTRATIVO SIMPLIFICADO =============
  const calcularDemonstrativoSimplificado = useCallback((): DemonstrativoSimplificado => {
    const { transacoesFinanceiras, pagamentosWorkflow, itensFinanceiros } = data;

    // 1. CALCULAR RECEITAS
    const receitaSessoes = pagamentosWorkflow
      .filter(p => {
        const dataEfetiva = getPagamentoEffectiveDate(p);
        return dataEfetiva && dataEfetiva >= filtros.dataInicio && dataEfetiva <= filtros.dataFim;
      })
      .reduce((sum, p) => {
        // Receita de sessão = valor total menos produtos extras
        const valorSessao = p.valor - (p.valorProdutoExtra || 0);
        return sum + Math.max(0, valorSessao);
      }, 0);

    const receitaProdutos = pagamentosWorkflow
      .filter(p => {
        const dataEfetiva = getPagamentoEffectiveDate(p);
        return dataEfetiva && dataEfetiva >= filtros.dataInicio && dataEfetiva <= filtros.dataFim;
      })
      .reduce((sum, p) => sum + (p.valorProdutoExtra || 0), 0);

    const receitaNaoOperacional = transacoesFinanceiras
      .filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        const dataEfetiva = getTransacaoEffectiveDate(t);
        return item?.grupo_principal === 'Receita Não Operacional' &&
               dataEfetiva && dataEfetiva >= filtros.dataInicio && dataEfetiva <= filtros.dataFim;
      })
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceitas = receitaSessoes + receitaProdutos + receitaNaoOperacional;

    // 2. CALCULAR DESPESAS POR CATEGORIA
    const categorias: Array<{
      grupo: string;
      itens: Array<{ nome: string; valor: number; }>;
      total: number;
    }> = [];

    GRUPOS_DESPESAS.forEach(grupo => {
      const transacoesGrupo = transacoesFinanceiras.filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        const dataEfetiva = getTransacaoEffectiveDate(t);
        return item?.grupo_principal === grupo &&
               dataEfetiva && dataEfetiva >= filtros.dataInicio && dataEfetiva <= filtros.dataFim;
      });

      if (transacoesGrupo.length > 0) {
        // Agrupar por item financeiro
        const itensPorNome: Record<string, number> = {};
        
        transacoesGrupo.forEach(t => {
          const item = itensFinanceiros.find(i => i.id === t.itemId);
          const nome = item?.nome || 'Item removido';
          itensPorNome[nome] = (itensPorNome[nome] || 0) + t.valor;
        });

        const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({
          nome,
          valor
        }));

        const total = itens.reduce((sum, item) => sum + item.valor, 0);

        categorias.push({
          grupo,
          itens,
          total
        });
      }
    });

    const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);

    // 3. CALCULAR RESUMO FINAL
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
  }, [data, filtros]);

  const demonstrativo = useMemo(() => calcularDemonstrativoSimplificado(), [calcularDemonstrativoSimplificado]);

  // ============= CÁLCULO PARA PERÍODO ESPECÍFICO =============
  const calcularDemonstrativoParaPeriodo = useCallback((dataInicio: string, dataFim: string): DemonstrativoSimplificado => {
    const { transacoesFinanceiras, pagamentosWorkflow, itensFinanceiros } = data;
    
    // Normalizar datas de entrada
    const dataInicioNorm = normalizeDate(dataInicio);
    const dataFimNorm = normalizeDate(dataFim);

    // Filtrar pagamentos do workflow para o período usando lógica de data efetiva
    const pagamentosPeriodo = pagamentosWorkflow.filter(p => {
      const dataEfetiva = getPagamentoEffectiveDate(p);
      return dataEfetiva && dataEfetiva >= dataInicioNorm && dataEfetiva <= dataFimNorm;
    });

    // Filtrar transações financeiras para o período usando lógica de data efetiva
    const transacoesPeriodo = transacoesFinanceiras.filter(t => {
      const dataEfetiva = getTransacaoEffectiveDate(t);
      return dataEfetiva && dataEfetiva >= dataInicioNorm && dataEfetiva <= dataFimNorm;
    });

    // 1. CALCULAR RECEITAS
    const receitaSessoes = pagamentosPeriodo.reduce((sum, p) => {
      const valorSessao = p.valor - (p.valorProdutoExtra || 0);
      return sum + Math.max(0, valorSessao);
    }, 0);

    const receitaProdutos = pagamentosPeriodo.reduce((sum, p) => sum + (p.valorProdutoExtra || 0), 0);

    const receitaNaoOperacional = transacoesPeriodo
      .filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === 'Receita Não Operacional';
      })
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceitas = receitaSessoes + receitaProdutos + receitaNaoOperacional;

    // 2. CALCULAR DESPESAS POR CATEGORIA
    const categorias: Array<{
      grupo: string;
      itens: Array<{ nome: string; valor: number; }>;
      total: number;
    }> = [];
    
    GRUPOS_DESPESAS.forEach(grupo => {
      const transacoesGrupo = transacoesPeriodo.filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === grupo;
      });

      if (transacoesGrupo.length > 0) {
        const itensPorNome: Record<string, number> = {};
        
        transacoesGrupo.forEach(t => {
          const item = itensFinanceiros.find(i => i.id === t.itemId);
          const nome = item?.nome || 'Item removido';
          itensPorNome[nome] = (itensPorNome[nome] || 0) + t.valor;
        });

        const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({
          nome,
          valor
        }));

        const total = itens.reduce((sum, item) => sum + item.valor, 0);

        categorias.push({
          grupo,
          itens,
          total
        });
      }
    });

    const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);

    // 3. CALCULAR RESUMO FINAL
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
  }, [data]);

  return {
    resumo,
    linhasComSaldo,
    demonstrativo,
    calcularDemonstrativoParaPeriodo
  };
}