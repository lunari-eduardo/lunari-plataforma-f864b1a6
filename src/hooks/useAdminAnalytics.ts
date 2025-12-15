import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { 
  FaturamentoPorCidade, 
  FaturamentoPorNicho, 
  FaturamentoPorCidadeNicho, 
  CrescimentoMensal,
  AdminFilters,
  AdminKpis
} from '@/types/admin-analytics';

export function useAdminAnalytics(filters: AdminFilters) {
  const [faturamentoCidade, setFaturamentoCidade] = useState<FaturamentoPorCidade[]>([]);
  const [faturamentoNicho, setFaturamentoNicho] = useState<FaturamentoPorNicho[]>([]);
  const [faturamentoCidadeNicho, setFaturamentoCidadeNicho] = useState<FaturamentoPorCidadeNicho[]>([]);
  const [crescimentoMensal, setCrescimentoMensal] = useState<CrescimentoMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calcular datas com base no período selecionado
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    
    switch (filters.periodo) {
      case 'mes_atual':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ultimo_trimestre':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'ultimo_ano':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'todos':
      default:
        startDate = null;
    }
    
    return { startDate };
  }, [filters.periodo]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Carregar todas as views em paralelo
        const [cidadeRes, nichoRes, cidadeNichoRes, crescimentoRes] = await Promise.all([
          supabase.from('faturamento_por_cidade').select('*'),
          supabase.from('faturamento_por_nicho').select('*'),
          supabase.from('faturamento_por_cidade_nicho').select('*'),
          supabase.from('crescimento_mensal').select('*')
        ]);

        if (cidadeRes.data) setFaturamentoCidade(cidadeRes.data as FaturamentoPorCidade[]);
        if (nichoRes.data) setFaturamentoNicho(nichoRes.data as FaturamentoPorNicho[]);
        if (cidadeNichoRes.data) setFaturamentoCidadeNicho(cidadeNichoRes.data as FaturamentoPorCidadeNicho[]);
        if (crescimentoRes.data) setCrescimentoMensal(crescimentoRes.data as CrescimentoMensal[]);
      } catch (error) {
        console.error('Erro ao carregar analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtrar dados por período
  const filteredCidade = useMemo(() => {
    let data = faturamentoCidade;
    
    if (dateRange.startDate) {
      data = data.filter(item => {
        if (!item.mes) return false;
        return new Date(item.mes) >= dateRange.startDate!;
      });
    }
    
    if (filters.nicho) {
      // Para filtrar por nicho, precisamos cruzar com a view cidade_nicho
      const cidadesDoNicho = faturamentoCidadeNicho
        .filter(cn => cn.nicho === filters.nicho)
        .map(cn => cn.cidade);
      data = data.filter(item => cidadesDoNicho.includes(item.cidade));
    }
    
    if (filters.cidade) {
      data = data.filter(item => item.cidade === filters.cidade);
    }

    // Agrupar por cidade (remover duplicatas de diferentes meses)
    const grouped = data.reduce((acc, item) => {
      const key = `${item.cidade}-${item.estado}`;
      if (!acc[key]) {
        acc[key] = { ...item, faturamento_total: 0, total_fotografos: 0 };
      }
      acc[key].faturamento_total += Number(item.faturamento_total);
      acc[key].total_fotografos = Math.max(acc[key].total_fotografos, Number(item.total_fotografos));
      return acc;
    }, {} as Record<string, FaturamentoPorCidade>);

    return Object.values(grouped)
      .map(item => ({
        ...item,
        ticket_medio: item.total_fotografos > 0 ? item.faturamento_total / item.total_fotografos : 0
      }))
      .sort((a, b) => b.faturamento_total - a.faturamento_total);
  }, [faturamentoCidade, faturamentoCidadeNicho, dateRange, filters.nicho, filters.cidade]);

  // Filtrar nichos por período
  const filteredNicho = useMemo(() => {
    let data = faturamentoNicho;
    
    if (dateRange.startDate) {
      data = data.filter(item => {
        if (!item.mes) return false;
        return new Date(item.mes) >= dateRange.startDate!;
      });
    }
    
    if (filters.nicho) {
      data = data.filter(item => item.nicho === filters.nicho);
    }

    // Agrupar por nicho
    const grouped = data.reduce((acc, item) => {
      if (!acc[item.nicho]) {
        acc[item.nicho] = { ...item, faturamento_total: 0, total_usuarios: 0 };
      }
      acc[item.nicho].faturamento_total += Number(item.faturamento_total);
      acc[item.nicho].total_usuarios = Math.max(acc[item.nicho].total_usuarios, Number(item.total_usuarios));
      return acc;
    }, {} as Record<string, FaturamentoPorNicho>);

    return Object.values(grouped)
      .map(item => ({
        ...item,
        ticket_medio: item.total_usuarios > 0 ? item.faturamento_total / item.total_usuarios : 0
      }))
      .sort((a, b) => b.faturamento_total - a.faturamento_total);
  }, [faturamentoNicho, dateRange, filters.nicho]);

  // Filtrar cruzamento cidade x nicho
  const filteredCidadeNicho = useMemo(() => {
    let data = faturamentoCidadeNicho;
    
    if (dateRange.startDate) {
      data = data.filter(item => {
        if (!item.mes) return false;
        return new Date(item.mes) >= dateRange.startDate!;
      });
    }
    
    if (filters.nicho) {
      data = data.filter(item => item.nicho === filters.nicho);
    }
    
    if (filters.cidade) {
      data = data.filter(item => item.cidade === filters.cidade);
    }

    // Agrupar por cidade + nicho
    const grouped = data.reduce((acc, item) => {
      const key = `${item.cidade}-${item.nicho}`;
      if (!acc[key]) {
        acc[key] = { ...item, faturamento_total: 0, total_usuarios: 0 };
      }
      acc[key].faturamento_total += Number(item.faturamento_total);
      acc[key].total_usuarios = Math.max(acc[key].total_usuarios, Number(item.total_usuarios));
      return acc;
    }, {} as Record<string, FaturamentoPorCidadeNicho>);

    return Object.values(grouped)
      .sort((a, b) => b.faturamento_total - a.faturamento_total);
  }, [faturamentoCidadeNicho, dateRange, filters.nicho, filters.cidade]);

  // Calcular KPIs
  const kpis = useMemo((): AdminKpis => {
    const faturamentoTotal = filteredCidade.reduce((sum, item) => sum + item.faturamento_total, 0);
    const totalFotografos = new Set(filteredCidade.map(c => c.cidade)).size > 0 
      ? filteredCidade.reduce((sum, item) => sum + item.total_fotografos, 0) 
      : 0;
    const ticketMedio = totalFotografos > 0 ? faturamentoTotal / totalFotografos : 0;

    // Calcular crescimento comparando com período anterior
    let crescimentoPercentual = 0;
    if (crescimentoMensal.length >= 2) {
      const mesAtual = crescimentoMensal[0]?.faturamento || 0;
      const mesAnterior = crescimentoMensal[1]?.faturamento || 0;
      if (mesAnterior > 0) {
        crescimentoPercentual = ((mesAtual - mesAnterior) / mesAnterior) * 100;
      }
    }

    return {
      faturamentoTotal,
      ticketMedio,
      fotografosAtivos: totalFotografos,
      crescimentoPercentual
    };
  }, [filteredCidade, crescimentoMensal]);

  // Extrair listas únicas para filtros
  const cidadesDisponiveis = useMemo(() => 
    [...new Set(faturamentoCidade.map(c => c.cidade))].filter(Boolean).sort(),
    [faturamentoCidade]
  );

  const nichosDisponiveis = useMemo(() => 
    [...new Set(faturamentoNicho.map(n => n.nicho))].filter(Boolean).sort(),
    [faturamentoNicho]
  );

  return {
    isLoading,
    kpis,
    faturamentoCidade: filteredCidade,
    faturamentoNicho: filteredNicho,
    faturamentoCidadeNicho: filteredCidadeNicho,
    crescimentoMensal,
    cidadesDisponiveis,
    nichosDisponiveis
  };
}
