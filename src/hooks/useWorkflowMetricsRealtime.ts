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

        // Resolver janela de datas
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

        // 1) Sessões — previsto, a receber e contagem (fonte: clientes_sessoes)
        //    Onda 2.2: aReceber via GREATEST(saldo, 0), excluindo historico e status NULL.
        const { data: sessoes, error: errSess } = await supabase
          .from('clientes_sessoes')
          .select('valor_total, valor_pago, status, tipo_registro')
          .eq('user_id', user.id)
          .gte('data_sessao', startDate)
          .lte('data_sessao', endDate);

        if (errSess) {
          console.error('❌ [WorkflowMetricsRealtime] Sessões:', errSess);
          return;
        }

        const sessoesValidas = (sessoes || []).filter(
          (s: any) => s.status && s.status !== 'historico'
        );
        const previsto = sessoesValidas.reduce(
          (sum, s: any) => sum + (Number(s.valor_total) || 0), 0
        );
        const aReceber = sessoesValidas
          .filter((s: any) => s.tipo_registro === 'workflow' || s.tipo_registro == null)
          .reduce((sum, s: any) => {
            const saldo = (Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0);
            return sum + Math.max(saldo, 0);
          }, 0);

        // 2) Receita — via view extrato_unificado (regime competência via data_competencia)
        //    Onda 2.1: usa transações reais (inclui órfãs/gallery), deduz estornos.
        const { data: linhas, error: errExt } = await supabase
          .from('extrato_unificado')
          .select('tipo, valor, natureza, origem, status')
          .eq('user_id', user.id)
          .eq('status', 'Pago')
          .in('origem', ['workflow', 'gallery'])
          .gte('data_competencia', startDate)
          .lte('data_competencia', endDate);

        if (errExt) {
          console.error('❌ [WorkflowMetricsRealtime] Extrato:', errExt);
          return;
        }

        const receita = (linhas || []).reduce((sum, l: any) => {
          const v = Number(l.valor) || 0;
          if (l.natureza === 'pagamento') return sum + v;
          if (l.natureza === 'estorno') return sum - v;
          return sum;
        }, 0);

        setMetrics({
          previsto,
          receita,
          aReceber,
          sessoes: sessoesValidas.length,
        });
      } catch (err) {
        console.error('❌ [WorkflowMetricsRealtime] Error:', err);
      }
    };

    loadMetrics();

    // Onda 4b — quando ativa a flag, reagimos ao eventBus + CustomEvent do
    // realtime unificado (v2) em vez de subir um canal Supabase dedicado.
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
      return () => {
        offCard(); offAdv(); offDel(); offPay(); offRef(); offAtt();
        window.removeEventListener('workflow-session-updated', reload);
        window.removeEventListener('workflow-session-deleted', reload);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year, month, startDateOverride, endDateOverride]);

  return metrics;
}
