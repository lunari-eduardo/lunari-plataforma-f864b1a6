import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowMetrics {
  previsto: number;    // soma de valor_total
  receita: number;     // soma de valor_pago
  aReceber: number;    // previsto - receita
  sessoes: number;     // contagem de sessões
}

/**
 * Hook para métricas do Workflow em tempo real
 * Calcula métricas diretamente do Supabase com subscriptions em tempo real
 * 
 * @param year - Ano para filtrar
 * @param month - Mês para filtrar (opcional, se não fornecido retorna métricas anuais)
 * @returns Métricas calculadas em tempo real
 */
export function useWorkflowMetricsRealtime(year: number, month?: number): WorkflowMetrics {
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
        if (!user) {
          console.warn('⚠️ [WorkflowMetricsRealtime] User not authenticated');
          return;
        }

        // Query com filtro de período
        let query = supabase
          .from('clientes_sessoes')
          .select('valor_total, valor_pago')
          .eq('user_id', user.id)
          .neq('status', 'historico'); // Excluir sessões históricas

        // Filtrar por ano/mês
        if (month) {
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          // Calcular último dia do mês
          const lastDay = new Date(year, month, 0).getDate();
          const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
          query = query.gte('data_sessao', startDate).lte('data_sessao', endDate);
          
          console.log(`📊 [WorkflowMetricsRealtime] Loading metrics for ${year}-${String(month).padStart(2, '0')}`);
        } else {
          query = query.gte('data_sessao', `${year}-01-01`).lte('data_sessao', `${year}-12-31`);
          
          console.log(`📊 [WorkflowMetricsRealtime] Loading metrics for year ${year}`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ [WorkflowMetricsRealtime] Error loading metrics:', error);
          return;
        }

        if (data) {
          const previsto = data.reduce((sum, s) => sum + (Number(s.valor_total) || 0), 0);
          const receita = data.reduce((sum, s) => sum + (Number(s.valor_pago) || 0), 0);
          
          const newMetrics = {
            previsto,
            receita,
            aReceber: previsto - receita,
            sessoes: data.length
          };

          console.log(`✅ [WorkflowMetricsRealtime] Metrics calculated:`, newMetrics);
          setMetrics(newMetrics);
        }
      } catch (err) {
        console.error('❌ [WorkflowMetricsRealtime] Error:', err);
      }
    };

    loadMetrics();

    // Realtime subscription para atualizações automáticas
    const channel = supabase
      .channel(`workflow-metrics-${year}-${month || 'all'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes'
      }, (payload) => {
        console.log('🔄 [WorkflowMetricsRealtime] Session changed, reloading metrics:', payload.eventType);
        loadMetrics();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes'
      }, (payload) => {
        console.log('💰 [WorkflowMetricsRealtime] Transaction changed, reloading metrics:', payload.eventType);
        loadMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year, month]);

  return metrics;
}
