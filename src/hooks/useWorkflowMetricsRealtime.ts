import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { USE_METRICS_EVENT_BUS } from '@/features/workflow/config';
import { eventBus } from '@/shared/event-bus';

interface WorkflowMetrics {
  previsto: number;
  receita: number;
  aReceber: number;
  sessoes: number;
}

/**
 * Hook para métricas do Workflow em tempo real
 * Suporta filtro por year+month OU por startDate+endDate
 */
export function useWorkflowMetricsRealtime(
  year: number, 
  month?: number,
  startDateOverride?: string,
  endDateOverride?: string
): WorkflowMetrics {
  const [metrics, setMetrics] = useState<WorkflowMetrics>({
    previsto: 0,
    receita: 0,
    aReceber: 0,
    sessoes: 0
  });

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let query = supabase
          .from('clientes_sessoes')
          .select('valor_total, valor_pago')
          .eq('user_id', user.id)
          .neq('status', 'historico');

        // Se override de datas, usar diretamente
        if (startDateOverride && endDateOverride) {
          query = query.gte('data_sessao', startDateOverride).lte('data_sessao', endDateOverride);
        } else if (month) {
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
          query = query.gte('data_sessao', startDate).lte('data_sessao', endDate);
        } else {
          query = query.gte('data_sessao', `${year}-01-01`).lte('data_sessao', `${year}-12-31`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ [WorkflowMetricsRealtime] Error:', error);
          return;
        }

        if (data) {
          const previsto = data.reduce((sum, s) => sum + (Number(s.valor_total) || 0), 0);
          const receita = data.reduce((sum, s) => sum + (Number(s.valor_pago) || 0), 0);
          
          setMetrics({
            previsto,
            receita,
            aReceber: previsto - receita,
            sessoes: data.length
          });
        }
      } catch (err) {
        console.error('❌ [WorkflowMetricsRealtime] Error:', err);
      }
    };

    loadMetrics();

    const channel = supabase
      .channel(`workflow-metrics-${year}-${month || 'all'}-${startDateOverride || ''}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes'
      }, () => loadMetrics())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes'
      }, () => loadMetrics())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year, month, startDateOverride, endDateOverride]);

  return metrics;
}
