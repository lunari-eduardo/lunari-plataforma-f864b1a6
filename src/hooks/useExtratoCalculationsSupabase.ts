/**
 * Hook para cálculos do extrato usando queries Supabase otimizadas
 * Suporta regime contábil (caixa | competencia)
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
  // ============= CÁLCULO DO RESUMO =============
  const resumo = useMemo((): ResumoExtrato => {
    const entradas = linhasFiltradas.filter(l => l.tipo === 'entrada');
    const saidas = linhasFiltradas.filter(l => l.tipo === 'saida');
    
    const entradasPagas = entradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const entradasFaturadas = entradas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const entradasAgendadas = entradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalEntradas = entradasPagas + entradasFaturadas + entradasAgendadas;
    
    const saidasPagas = saidas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    const saidasFaturadas = saidas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const saidasAgendadas = saidas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalSaidas = saidasPagas + saidasFaturadas + saidasAgendadas;
    
    const saldoEfetivo = entradasPagas - saidasPagas;
    const saldoProjetado = totalEntradas - totalSaidas;
    const saldoPeriodo = saldoProjetado;
    
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
    queryKey: ['demonstrativo-financeiro', regime, filtros.dataInicio, filtros.dataFim],
    queryFn: async () => {
      // ====== RECEITAS — Pagamentos de sessões ======
      // Caixa: filtra por data_transacao
      // Competência: filtra por data_sessao (com fallback para data_transacao quando NULL)
      let pagamentosQuery = supabase
        .from('clientes_transacoes')
        .select(`
          valor,
          session_id,
          data_transacao,
          clientes_sessoes!fk_transacoes_session_id (data_sessao)
        `)
        .eq('tipo', 'pagamento');

      if (regime === 'caixa') {
        pagamentosQuery = pagamentosQuery
          .gte('data_transacao', filtros.dataInicio)
          .lte('data_transacao', filtros.dataFim);
      }

      const { data: pagamentosSessoesRaw, error: errorPagamentos } = await pagamentosQuery;
      if (errorPagamentos) throw errorPagamentos;

      // No regime de competência, filtramos no client após resolver a data efetiva
      const pagamentosSessoes = (pagamentosSessoesRaw || []).filter((p: any) => {
        if (regime === 'caixa') return true;
        const dataRef = p.clientes_sessoes?.data_sessao || p.data_transacao;
        return dataRef >= filtros.dataInicio && dataRef <= filtros.dataFim;
      });

      const receitaSessoes = pagamentosSessoes
        .filter((p: any) => p.session_id)
        .reduce((sum: number, p: any) => sum + Number(p.valor), 0);

      const receitaProdutos = pagamentosSessoes
        .filter((p: any) => !p.session_id)
        .reduce((sum: number, p: any) => sum + Number(p.valor), 0);

      // ====== RECEITAS NÃO OPERACIONAIS (avulsas) ======
      // Caixa: status=Pago + filtra por data_vencimento
      // Competência: ignora status, filtra por data_competencia (fallback data_vencimento)
      let receitasNaoOpQuery = supabase
        .from('fin_transactions')
        .select(`
          valor,
          status,
          data_vencimento,
          data_competencia,
          fin_items_master!inner(grupo_principal)
        `)
        .eq('fin_items_master.grupo_principal', 'Receita Não Operacional');

      if (regime === 'caixa') {
        receitasNaoOpQuery = receitasNaoOpQuery
          .eq('status', 'Pago')
          .gte('data_vencimento', filtros.dataInicio)
          .lte('data_vencimento', filtros.dataFim);
      }

      const { data: receitasNaoOpRaw, error: errorReceitasNaoOp } = await receitasNaoOpQuery;
      if (errorReceitasNaoOp) throw errorReceitasNaoOp;

      const receitasNaoOp = (receitasNaoOpRaw || []).filter((r: any) => {
        if (regime === 'caixa') return true;
        const dataRef = r.data_competencia || r.data_vencimento;
        return dataRef >= filtros.dataInicio && dataRef <= filtros.dataFim;
      });

      const receitaNaoOperacional = receitasNaoOp.reduce(
        (sum: number, r: any) => sum + Number(r.valor), 0
      );

      // ====== DESPESAS AGRUPADAS ======
      const categorias: Array<{
        grupo: string;
        itens: Array<{ nome: string; valor: number; }>;
        total: number;
      }> = [];

      for (const grupo of GRUPOS_DESPESAS) {
        let despesasQuery = supabase
          .from('fin_transactions')
          .select(`
            valor,
            status,
            data_vencimento,
            data_competencia,
            fin_items_master!inner(nome, grupo_principal)
          `)
          .eq('fin_items_master.grupo_principal', grupo);

        if (regime === 'caixa') {
          despesasQuery = despesasQuery
            .eq('status', 'Pago')
            .gte('data_vencimento', filtros.dataInicio)
            .lte('data_vencimento', filtros.dataFim);
        }

        const { data: despesasGrupoRaw, error: errorDespesas } = await despesasQuery;
        if (errorDespesas) throw errorDespesas;

        const despesasGrupo = (despesasGrupoRaw || []).filter((d: any) => {
          if (regime === 'caixa') return true;
          const dataRef = d.data_competencia || d.data_vencimento;
          return dataRef >= filtros.dataInicio && dataRef <= filtros.dataFim;
        });

        if (despesasGrupo.length > 0) {
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

      // ====== TAXAS DE GATEWAY ======
      // Sempre filtra junto com as receitas de sessão (mesma data de referência)
      let taxasQuery = supabase
        .from('clientes_transacoes')
        .select(`
          taxa_gateway,
          taxa_antecipacao,
          data_transacao,
          clientes_sessoes!fk_transacoes_session_id (data_sessao)
        `)
        .eq('tipo', 'pagamento');

      if (regime === 'caixa') {
        taxasQuery = taxasQuery
          .gte('data_transacao', filtros.dataInicio)
          .lte('data_transacao', filtros.dataFim);
      }

      const { data: taxasRaw, error: errorTaxas } = await taxasQuery;
      if (errorTaxas) throw errorTaxas;

      const taxasGateway = (taxasRaw || []).filter((t: any) => {
        if (regime === 'caixa') return true;
        const dataRef = t.clientes_sessoes?.data_sessao || t.data_transacao;
        return dataRef >= filtros.dataInicio && dataRef <= filtros.dataFim;
      });

      const totalTaxasGw = taxasGateway.reduce(
        (sum: number, t: any) => sum + Number(t.taxa_gateway || 0), 0);
      const totalTaxasAnt = taxasGateway.reduce(
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
