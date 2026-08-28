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
import { useDemonstrativoFinanceiro } from '@/hooks/useDemonstrativoFinanceiro';

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
        .select('valor_total, valor_pago, status')
        .eq('tipo_registro', 'workflow')
        .or('status.is.null,status.not.in.(historico,stub)')
        .gte('data_sessao', filtros.dataInicio)
        .lte('data_sessao', filtros.dataFim);

      if (error) throw error;

      // Regra canônica: Σ GREATEST(valor_total - valor_pago, 0) por sessão.
      // Sessões arquivadas (historico) já foram excluídas no filtro server-side.
      return (data || []).reduce((acc, s: any) => {
        const total = Number(s.valor_total) || 0;
        const pago = Number(s.valor_pago) || 0;
        const saldo = total - pago;
        return acc + (saldo > 0 ? saldo : 0);
      }, 0);
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
        .select('tipo, status, valor, natureza')
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
        estornos: 0,
      };

      (data || []).forEach((r: any) => {
        const v = Number(r.valor) || 0;
        if (r.tipo === 'entrada') {
          acc.countEntradas++;
          if (r.status === 'Pago') acc.entradasPagas += v;
          else if (r.status === 'Faturado') acc.entradasFaturadas += v;
          else if (r.status === 'Agendado') acc.entradasAgendadas += v;
        } else if (r.tipo === 'saida') {
          // Onda 1/3: estornos NÃO são despesa — são redução de receita.
          if (r.natureza === 'estorno') {
            acc.estornos += v;
            acc.entradasPagas -= v; // deduz da receita paga (regime caixa e competência)
            return;
          }
          if (r.status === 'Pago') acc.saidasPagas += v;
          else if (r.status === 'Faturado') acc.saidasFaturadas += v;
          else if (r.status === 'Agendado') acc.saidasAgendadas += v;
        }
      });

      return acc;
    },
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ============= CÁLCULO DO RESUMO (a partir de totais agregados) =============
  const resumo = useMemo((): ResumoExtrato => {
    const t = totaisPeriodo || {
      entradasPagas: 0, entradasFaturadas: 0, entradasAgendadas: 0,
      saidasPagas: 0, saidasFaturadas: 0, saidasAgendadas: 0,
      countEntradas: 0, estornos: 0,
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

  // ============= DEMONSTRATIVO (fonte única: useDemonstrativoFinanceiro) =============
  const { demonstrativo } = useDemonstrativoFinanceiro(
    filtros.dataInicio,
    filtros.dataFim,
    regime
  );

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

