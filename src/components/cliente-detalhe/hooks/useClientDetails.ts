import { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { autoFixIfNeeded, getSimplifiedClientMetrics } from '@/utils/crmDataFix';
import { useFileUpload } from '@/hooks/useFileUpload';

export function useClientDetails(clienteId: string | undefined) {
  const { clientes, atualizarCliente } = useContext(AppContext);
  const { loadFiles } = useFileUpload();
  const [isLoading, setIsLoading] = useState(true);

  // Carregar arquivos e executar correção automática
  useEffect(() => {
    const initializeData = async () => {
      try {
        await autoFixIfNeeded();
        await loadFiles();
      } catch (error) {
        console.error('Error initializing client data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [loadFiles]);

  // Encontrar o cliente pelo ID
  const cliente = useMemo(() => {
    return clientes.find(c => c.id === clienteId);
  }, [clientes, clienteId]);

  // Métricas simplificadas e precisas
  const metricas = useMemo(() => {
    if (!cliente) return {
      totalSessoes: 0,
      totalFaturado: 0,
      totalPago: 0,
      aReceber: 0,
      agendado: 0
    };
    
    // Buscar sessões do workflow para calcular valor agendado
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const clientSessions = workflowSessions.filter((session: any) => {
      const matchByClienteId = session.clienteId === cliente.id;
      const matchByName = !session.clienteId && session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });
    
    // Calcular valor agendado baseado em pagamentos pendentes
    const valorAgendado = clientSessions
      .reduce((total: number, session: any) => {
        if (!session.pagamentos || !Array.isArray(session.pagamentos)) return total;
        
        const pagamentosPendentes = session.pagamentos
          .filter((pagamento: any) => pagamento.statusPagamento === 'pendente')
          .reduce((subtotal: number, pagamento: any) => {
            const valor = typeof pagamento.valor === 'number' ? pagamento.valor : 
                         parseFloat(String(pagamento.valor || '0').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;
            return subtotal + valor;
          }, 0);
        
        return total + pagamentosPendentes;
      }, 0);

    const clientMetrics = getSimplifiedClientMetrics([cliente]);
    const metrics = clientMetrics[0];
    if (!metrics) return {
      totalSessoes: 0,
      totalFaturado: 0,
      totalPago: 0,
      aReceber: 0,
      agendado: valorAgendado
    };
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
    isLoading,
    atualizarCliente
  };
}