import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
import { useOpeningBalance } from '@/hooks/useOpeningBalance';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { TransacaoComItem } from './types';

export const useDashboardQueries = () => {
  const { getAvailableYears } = useWorkflowMetrics();
  const { itensFinanceiros, transacoes: transacoesFinanceiras } = useNovoFinancas();
  const dashUserId = useCurrentUserId();

  const itensMap = useMemo(() => {
    return new Map(itensFinanceiros.map((item) => [item.id, item]));
  }, [itensFinanceiros]);

  // Query de anos disponíveis no banco
  const { data: anosFromDB = [] } = useQuery({
    queryKey: ['dashboard-available-years'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: sessoesYears } = await supabase
        .from('clientes_sessoes')
        .select('data_sessao')
        .eq('user_id', user.id);

      const { data: transacoesYears } = await supabase
        .from('fin_transactions')
        .select('data_vencimento')
        .eq('user_id', user.id);

      const anos = new Set<number>();

      sessoesYears?.forEach((s) => {
        if (s.data_sessao) {
          const ano = parseInt(s.data_sessao.split('-')[0]);
          if (!isNaN(ano)) anos.add(ano);
        }
      });

      transacoesYears?.forEach((t) => {
        if (t.data_vencimento) {
          const ano = parseInt(t.data_vencimento.split('-')[0]);
          if (!isNaN(ano)) anos.add(ano);
        }
      });

      return Array.from(anos).sort((a, b) => b - a);
    },
    staleTime: 1000 * 60 * 5,
  });

  const anosDisponiveis = useMemo(() => {
    const anosWorkflow = getAvailableYears();
    const anosTransacoes = new Set<number>();

    transacoesFinanceiras.forEach((transacao) => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return;
      }
      const ano = parseInt(transacao.dataVencimento.split('-')[0]);
      if (!isNaN(ano)) {
        anosTransacoes.add(ano);
      }
    });

    const todosAnos = new Set([...anosWorkflow, ...anosTransacoes, ...anosFromDB]);

    if (todosAnos.size === 0) {
      todosAnos.add(new Date().getFullYear());
    }

    return Array.from(todosAnos).sort((a, b) => b - a);
  }, [getAvailableYears, transacoesFinanceiras, anosFromDB]);

  const [anoSelecionado, setAnoSelecionado] = useState(() => new Date().getFullYear().toString());
  const [mesSelecionado, setMesSelecionado] = useState<string>('ano-completo');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const ano = parseInt(anoSelecionado);
  const mesNumero =
    mesSelecionado !== 'ano-completo' && mesSelecionado !== 'personalizado'
      ? parseInt(mesSelecionado)
      : undefined;

  const { data: openingBalanceData } = useOpeningBalance(ano);

  const { startDate, endDate } = useMemo(() => {
    if (mesSelecionado === 'personalizado' && dataInicio && dataFim) {
      return { startDate: dataInicio, endDate: dataFim };
    } else if (mesSelecionado !== 'ano-completo' && mesSelecionado !== 'personalizado') {
      const mes = parseInt(mesSelecionado);
      const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const ultimoDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
      return { startDate: primeiroDia, endDate: ultimoDiaStr };
    }
    return { startDate: `${ano}-01-01`, endDate: `${ano}-12-31` };
  }, [ano, mesSelecionado, dataInicio, dataFim]);

  const { data: transacoesDoAno = [], isLoading: transacoesDoAnoLoading } = useQuery({
    queryKey: ['dashboard-transactions-period', dashUserId, startDate, endDate],
    enabled: !!dashUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_transactions')
        .select(`
          id,
          item_id,
          valor,
          data_vencimento,
          status,
          observacoes,
          fin_items_master (
            id,
            nome,
            grupo_principal
          )
        `)
        .eq('user_id', dashUserId!)
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)
        .order('data_vencimento', { ascending: true });

      if (error) {
        console.error('Erro ao buscar transações do período:', error);
        return [];
      }

      return (data || []).map((t: any) => ({
        id: t.id,
        itemId: t.item_id,
        valor: t.valor,
        dataVencimento: t.data_vencimento,
        status: t.status,
        observacoes: t.observacoes,
        item: t.fin_items_master
          ? {
              id: (t.fin_items_master as any).id,
              nome: (t.fin_items_master as any).nome,
              grupo_principal: (t.fin_items_master as any).grupo_principal,
            }
          : null,
      })) as TransacaoComItem[];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const periodoAnterior = useMemo(() => {
    if (mesSelecionado === 'personalizado') {
      return { ano: ano - 1, mes: undefined };
    } else if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesAtual = parseInt(mesSelecionado);
      if (mesAtual === 1) {
        return { ano: ano - 1, mes: 12 };
      } else {
        return { ano, mes: mesAtual - 1 };
      }
    } else {
      return { ano: ano - 1, mes: undefined };
    }
  }, [ano, mesSelecionado]);

  const { data: transacoesAnterior = [] } = useQuery({
    queryKey: ['dashboard-transactions-period-anterior', dashUserId, periodoAnterior.ano],
    enabled: !!dashUserId && !!periodoAnterior.ano,
    queryFn: async () => {
      const startDateAnt = `${periodoAnterior.ano}-01-01`;
      const endDateAnt = `${periodoAnterior.ano}-12-31`;

      const { data, error } = await supabase
        .from('fin_transactions')
        .select(`
          id,
          item_id,
          valor,
          data_vencimento,
          status,
          observacoes,
          fin_items_master (
            id,
            nome,
            grupo_principal
          )
        `)
        .eq('user_id', dashUserId!)
        .gte('data_vencimento', startDateAnt)
        .lte('data_vencimento', endDateAnt);

      if (error) return [];

      return (data || []).map((t: any) => ({
        id: t.id,
        itemId: t.item_id,
        valor: t.valor,
        dataVencimento: t.data_vencimento,
        status: t.status,
        observacoes: t.observacoes,
        item: t.fin_items_master
          ? {
              id: (t.fin_items_master as any).id,
              nome: (t.fin_items_master as any).nome,
              grupo_principal: (t.fin_items_master as any).grupo_principal,
            }
          : null,
      })) as TransacaoComItem[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    dashUserId,
    itensMap,
    transacoesFinanceiras,
    anosDisponiveis,
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    ano,
    mesNumero,
    openingBalanceData,
    startDate,
    endDate,
    transacoesDoAno,
    transacoesDoAnoLoading,
    periodoAnterior,
    transacoesAnterior,
  };
};
