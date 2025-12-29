import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyWorkflowMetrics {
  mes: number;
  receita: number;
  previsto: number;
  aReceber: number;
  sessoes: number;
}

interface WorkflowMetricsByYear {
  metricsPorMes: MonthlyWorkflowMetrics[];
  totalAnual: {
    receita: number;
    previsto: number;
    aReceber: number;
    sessoes: number;
  };
  isLoading: boolean;
}

/**
 * Hook para métricas do Workflow agrupadas por mês
 * Retorna dados mensais para gráficos anuais do dashboard
 * 
 * @param year - Ano para buscar métricas
 * @returns Métricas agrupadas por mês e totais anuais
 */
export function useWorkflowMetricsByYear(year: number): WorkflowMetricsByYear {
  const [metricsPorMes, setMetricsPorMes] = useState<MonthlyWorkflowMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('⚠️ [WorkflowMetricsByYear] User not authenticated');
          return;
        }

        // Buscar todas as sessões do ano
        const { data, error } = await supabase
          .from('clientes_sessoes')
          .select('data_sessao, valor_total, valor_pago')
          .eq('user_id', user.id)
          .neq('status', 'historico')
          .gte('data_sessao', `${year}-01-01`)
          .lte('data_sessao', `${year}-12-31`);

        if (error) {
          console.error('❌ [WorkflowMetricsByYear] Error loading metrics:', error);
          return;
        }

        // Agrupar por mês
        const porMes: Record<number, { receita: number; previsto: number; sessoes: number }> = {};
        
        // Inicializar todos os meses
        for (let m = 1; m <= 12; m++) {
          porMes[m] = { receita: 0, previsto: 0, sessoes: 0 };
        }

        // Agregar dados
        (data || []).forEach(sessao => {
          if (!sessao.data_sessao) return;
          const mes = parseInt(sessao.data_sessao.split('-')[1]);
          if (mes >= 1 && mes <= 12) {
            porMes[mes].receita += Number(sessao.valor_pago) || 0;
            porMes[mes].previsto += Number(sessao.valor_total) || 0;
            porMes[mes].sessoes += 1;
          }
        });

        // Converter para array
        const result: MonthlyWorkflowMetrics[] = Object.entries(porMes).map(([mes, dados]) => ({
          mes: parseInt(mes),
          receita: dados.receita,
          previsto: dados.previsto,
          aReceber: dados.previsto - dados.receita,
          sessoes: dados.sessoes
        }));

        console.log(`✅ [WorkflowMetricsByYear] Metrics for ${year}:`, result);
        setMetricsPorMes(result);
      } catch (err) {
        console.error('❌ [WorkflowMetricsByYear] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();

    // Realtime subscription
    const channel = supabase
      .channel(`workflow-metrics-year-${year}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes'
      }, () => {
        console.log('🔄 [WorkflowMetricsByYear] Session changed, reloading...');
        loadMetrics();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes'
      }, () => {
        console.log('💰 [WorkflowMetricsByYear] Transaction changed, reloading...');
        loadMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year]);

  // Calcular totais anuais
  const totalAnual = metricsPorMes.reduce(
    (acc, m) => ({
      receita: acc.receita + m.receita,
      previsto: acc.previsto + m.previsto,
      aReceber: acc.aReceber + m.aReceber,
      sessoes: acc.sessoes + m.sessoes
    }),
    { receita: 0, previsto: 0, aReceber: 0, sessoes: 0 }
  );

  return {
    metricsPorMes,
    totalAnual,
    isLoading
  };
}
