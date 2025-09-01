import { useMemo, useContext, useEffect } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { autoFixIfNeeded, getSimplifiedClientMetrics } from '@/utils/crmDataFix';
import { Cliente } from '@/types/orcamentos';

interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  agendado: number;
}

export function useClientDetails(clienteId?: string) {
  const { clientes } = useContext(AppContext);

  // Execute auto-fix on mount
  useEffect(() => {
    autoFixIfNeeded();
  }, []);

  // Find client by ID
  const cliente = useMemo(() => {
    if (!clienteId) return null;
    return clientes.find(c => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  // Calculate client metrics
  const metricas = useMemo((): ClientMetrics => {
    if (!cliente) {
      return {
        totalSessoes: 0,
        totalFaturado: 0,
        totalPago: 0,
        aReceber: 0,
        agendado: 0
      };
    }
    
    // Get workflow sessions to calculate scheduled value
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const clientSessions = workflowSessions.filter((session: any) => {
      const matchByClienteId = session.clienteId === cliente.id;
      const matchByName = !session.clienteId && 
        session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });
    
    // Calculate scheduled value based on pending payments
    const valorAgendado = clientSessions.reduce((total: number, session: any) => {
      if (!session.pagamentos || !Array.isArray(session.pagamentos)) return total;
      
      const pagamentosPendentes = session.pagamentos
        .filter((pagamento: any) => pagamento.statusPagamento === 'pendente')
        .reduce((subtotal: number, pagamento: any) => {
          const valor = typeof pagamento.valor === 'number' ? pagamento.valor : 
                       parseFloat(String(pagamento.valor || '0')
                         .replace(/[^\d,.-]/g, '')
                         .replace(/\./g, '')
                         .replace(/,/g, '.')) || 0;
          return subtotal + valor;
        }, 0);
      
      return total + pagamentosPendentes;
    }, 0);

    const clientMetrics = getSimplifiedClientMetrics([cliente]);
    const metrics = clientMetrics[0];
    
    if (!metrics) {
      return {
        totalSessoes: 0,
        totalFaturado: 0,
        totalPago: 0,
        aReceber: 0,
        agendado: valorAgendado
      };
    }

    return {
      totalSessoes: metrics.totalSessoes,
      totalFaturado: metrics.totalFaturado,
      totalPago: metrics.totalPago,
      aReceber: metrics.aReceber,
      agendado: valorAgendado
    };
  }, [cliente]);

  return {
    cliente,
    metricas,
    isLoading: false,
    error: null
  };
}