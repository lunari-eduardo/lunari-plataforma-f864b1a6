/**
 * Hook para cálculos do extrato usando queries Supabase otimizadas
 * Substitui processamento frontend por agregações no banco
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LinhaExtrato, ResumoExtrato, DemonstrativoSimplificado, FiltrosExtrato } from '@/types/extrato';
import { calcularSaldoAcumulado } from '@/utils/extratoUtils';
import { GRUPOS_DESPESAS } from '@/constants/extratoConstants';

export function useExtratoCalculationsSupabase(
  linhasFiltradas: LinhaExtrato[],
  filtros: FiltrosExtrato
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
    
    // SAÍDAS por status
    const saidasPagas = saidas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const saidasFaturadas = saidas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const saidasAgendadas = saidas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalSaidas = saidasPagas + saidasFaturadas + saidasAgendadas;
    
    // SALDOS
    const saldoEfetivo = entradasPagas - saidasPagas;
    const saldoProjetado = totalEntradas - totalSaidas;
    const saldoPeriodo = saldoProjetado;
    
    // MÉTRICAS AUXILIARES
    const totalAReceber = entradasAgendadas;
    const totalAgendado = linhasFiltradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalPago = linhasFiltradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    
    const ticketMedioEntradas = entradas.length > 0 ? totalEntradas / entradas.length : 0;
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
  }, [linhasFiltradas]);

  // ============= LINHAS COM SALDO ACUMULADO =============
  const linhasComSaldo = useMemo(() => {
    return calcularSaldoAcumulado(linhasFiltradas);
  }, [linhasFiltradas]);

  // ============= DEMONSTRATIVO COM QUERIES SUPABASE =============
  const { data: demonstrativoData } = useQuery({
    queryKey: ['demonstrativo-financeiro', filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      // RECEITAS - Pagamentos de sessões
      const { data: pagamentosSessoes, error: errorPagamentos } = await supabase
        .from('clientes_transacoes')
        .select('valor, session_id')
        .eq('tipo', 'pagamento')
        .gte('data_transacao', filtros.dataInicio)
        .lte('data_transacao', filtros.dataFim);

      if (errorPagamentos) throw errorPagamentos;

      const receitaSessoes = (pagamentosSessoes || [])
        .filter(p => p.session_id)
        .reduce((sum, p) => sum + Number(p.valor), 0);

      const receitaProdutos = (pagamentosSessoes || [])
        .filter(p => !p.session_id)
        .reduce((sum, p) => sum + Number(p.valor), 0);

      // RECEITAS NÃO OPERACIONAIS
      const { data: receitasNaoOp, error: errorReceitasNaoOp } = await supabase
        .from('fin_transactions')
        .select(`
          valor,
          fin_items_master!inner(grupo_principal)
        `)
        .eq('fin_items_master.grupo_principal', 'Receita Não Operacional')
        .eq('status', 'Pago')
        .gte('data_vencimento', filtros.dataInicio)
        .lte('data_vencimento', filtros.dataFim);

      if (errorReceitasNaoOp) throw errorReceitasNaoOp;

      const receitaNaoOperacional = (receitasNaoOp || [])
        .reduce((sum, r) => sum + Number(r.valor), 0);

      // DESPESAS AGRUPADAS
      const categorias: Array<{
        grupo: string;
        itens: Array<{ nome: string; valor: number; }>;
        total: number;
      }> = [];

      for (const grupo of GRUPOS_DESPESAS) {
        const { data: despesasGrupo, error: errorDespesas } = await supabase
          .from('fin_transactions')
          .select(`
            valor,
            fin_items_master!inner(nome, grupo_principal)
          `)
          .eq('fin_items_master.grupo_principal', grupo)
          .eq('status', 'Pago')
          .gte('data_vencimento', filtros.dataInicio)
          .lte('data_vencimento', filtros.dataFim);

        if (errorDespesas) throw errorDespesas;

        if (despesasGrupo && despesasGrupo.length > 0) {
          // Agrupar por nome do item
          const itensPorNome: Record<string, number> = {};
          
          despesasGrupo.forEach((d: any) => {
            const nome = d.fin_items_master?.nome || 'Item desconhecido';
            itensPorNome[nome] = (itensPorNome[nome] || 0) + Number(d.valor);
          });

          const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({
            nome,
            valor
          }));

          const total = itens.reduce((sum, item) => sum + item.valor, 0);

          categorias.push({ grupo, itens, total });
        }
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

  // ============= CÁLCULO PARA PERÍODO ESPECÍFICO =============
  const calcularDemonstrativoParaPeriodo = useCallback((
    dataInicio: string, 
    dataFim: string
  ): DemonstrativoSimplificado => {
    // Por enquanto retorna o demonstrativo atual
    // TODO: Implementar query específica para período personalizado
    return demonstrativo;
  }, [demonstrativo]);

  return {
    resumo,
    linhasComSaldo,
    demonstrativo,
    calcularDemonstrativoParaPeriodo
  };
}
