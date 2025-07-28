import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';

export interface ClienteWithMetricas extends Cliente {
  metricas: {
    totalSessoes: number;
    totalFaturado: number; // Renomeado de totalGasto
    totalPago: number;
    aReceber: number;
    ultimaSessao: string | null;
  };
}

export const useClienteMetrics = (clientes: Cliente[], workflowItems: WorkflowItem[]): ClienteWithMetricas[] => {
  return useMemo(() => {
    return clientes.map(cliente => {
      // Filtrar todos os workflowItems deste cliente específico
      const clienteWorkflowItems = workflowItems.filter(item => item.clienteId === cliente.id);
      
      // Calcular métricas baseadas exclusivamente nos workflowItems
      const totalSessoes = clienteWorkflowItems.length;
      const totalFaturado = clienteWorkflowItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalPago = clienteWorkflowItems.reduce((sum, item) => sum + (item.valorPago || 0), 0);
      const aReceber = clienteWorkflowItems.reduce((sum, item) => sum + (item.restante || 0), 0);
      
      // Encontrar a última sessão (data mais recente)
      let ultimaSessao: string | null = null;
      if (clienteWorkflowItems.length > 0) {
        const datasOrdenadas = clienteWorkflowItems
          .map(item => {
            // Converter string de data para Date para comparação
            if (item.dataOriginal instanceof Date) {
              return item.dataOriginal;
            }
            // Fallback: tentar parsear a string de data
            return new Date(item.data);
          })
          .sort((a, b) => b.getTime() - a.getTime()); // Ordenar do mais recente para o mais antigo
        
        // Formatar a data mais recente
        const dataRecente = datasOrdenadas[0];
        ultimaSessao = dataRecente.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      return {
        ...cliente,
        metricas: {
          totalSessoes,
          totalFaturado,
          totalPago,
          aReceber,
          ultimaSessao
        }
      };
    });
  }, [clientes, workflowItems]); // Dependências do useMemo conforme especificado
};