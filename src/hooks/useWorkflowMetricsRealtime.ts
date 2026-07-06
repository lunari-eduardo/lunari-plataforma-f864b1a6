import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { USE_METRICS_EVENT_BUS } from '@/features/workflow/config';
import { eventBus } from '@/shared/event-bus';

interface WorkflowMetrics {
  previsto: number;
  receita: number;
  aReceber: number;
  sessoes: number;
  creditosGerados: number;
  creditosUtilizados: number;
  caixaRecebido: number;
}

const EMPTY: WorkflowMetrics = {
  previsto: 0,
  receita: 0,
  aReceber: 0,
  sessoes: 0,
  creditosGerados: 0,
  creditosUtilizados: 0,
  caixaRecebido: 0,
};

/**
 * Hook canônico das métricas do Workflow no mês.
 * Chama o RPC `workflow_month_metrics` que já:
 *  - limita a receita ao valor da sessão (evita dupla contagem com crédito);
 *  - calcula pendente como GREATEST(valor_total - valor_pago, 0);
 *  - retorna créditos gerados/utilizados no mês e caixa real recebido.
 */
export function useWorkflowMetricsRealtime(
  year: number,
  month?: number,
  startDateOverride?: string,
  endDateOverride?: string
): WorkflowMetrics {
  const [metrics, setMetrics] = useState<WorkflowMetrics>(EMPTY);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let startDate: string;
        let endDate: string;
        if (startDateOverride && endDateOverride) {
          startDate = startDateOverride;
          endDate = endDateOverride;
        } else if (month) {
          startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        } else {
          startDate = `${year}-01-01`;
          endDate = `${year}-12-31`;
        }

        const { data, error } = await supabase.rpc('workflow_month_metrics', {
          p_user_id: user.id,
          p_start: startDate,
          p_end: endDate,
        });

        if (error) {
          console.error('❌ [WorkflowMetricsRealtime] RPC:', error);
          return;
        }

        const row: any = Array.isArray(data) ? data[0] : data;
        if (!row) { setMetrics(EMPTY); return; }

        setMetrics({
          previsto: Number(row.previsto) || 0,
          receita: Number(row.receita) || 0,
          aReceber: Number(row.pendente) || 0,
          sessoes: Number(row.sessoes) || 0,
          creditosGerados: Number(row.creditos_gerados) || 0,
          creditosUtilizados: Number(row.creditos_utilizados) || 0,
          caixaRecebido: Number(row.caixa_recebido) || 0,
        });
      } catch (err) {
        console.error('❌ [WorkflowMetricsRealtime] Error:', err);
      }
    };

    loadMetrics();

    if (USE_METRICS_EVENT_BUS) {
      const reload = () => { void loadMetrics(); };
      const offCard = eventBus.on('workflow.card_updated', reload);
      const offAdv = eventBus.on('workflow.card_advanced', reload);
      const offDel = eventBus.on('workflow.card_deleted', reload);
      const offPay = eventBus.on('workflow.payment_added', reload);
      const offRef = eventBus.on('workflow.payment_refunded', reload);
      const offAtt = eventBus.on('workflow.payment_attached', reload);
      window.addEventListener('workflow-session-updated', reload);
      window.addEventListener('workflow-session-deleted', reload);
      window.addEventListener('payment-created', reload);
      return () => {
        offCard(); offAdv(); offDel(); offPay(); offRef(); offAtt();
        window.removeEventListener('workflow-session-updated', reload);
        window.removeEventListener('workflow-session-deleted', reload);
        window.removeEventListener('payment-created', reload);
      };
    }

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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cliente_creditos_ledger'
      }, () => loadMetrics())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year, month, startDateOverride, endDateOverride]);

  return metrics;
}
