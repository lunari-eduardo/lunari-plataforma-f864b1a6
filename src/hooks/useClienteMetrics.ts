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
    console.log('🔄 CALCULANDO MÉTRICAS - useClienteMetrics:', {
      clientesLength: clientes?.length || 0,
      workflowItemsLength: workflowItems?.length || 0,
      primeiroCliente: clientes?.[0] ? { id: clientes[0].id, nome: clientes[0].nome } : null,
      primeiroWorkflow: workflowItems?.[0] ? { 
        id: workflowItems[0].id, 
        clienteId: workflowItems[0].clienteId, 
        nome: workflowItems[0].nome 
      } : null
    });

    // Se não há dados, retornar lista vazia
    if (!clientes || clientes.length === 0) {
      console.log('⚠️ Sem clientes para processar');
      return [];
    }

    return clientes.map(cliente => {
      // LÓGICA DIRETA: Filtrar workflowItems por clienteId
      const clienteWorkflowItems = workflowItems?.filter(item => {
        // Match direto por clienteId (PRIORIDADE)
        if (item.clienteId === cliente.id) {
          return true;
        }
        
        // Fallback: nome exato (case insensitive)
        if (item.nome && cliente.nome) {
          const match = item.nome.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
          if (match) {
            console.log(`🔗 Associação por nome: "${cliente.nome}" -> "${item.nome}"`);
            return true;
          }
        }
        
        // Fallback: telefone (apenas números)
        if (item.whatsapp && cliente.telefone) {
          const telefoneItem = item.whatsapp.replace(/\D/g, '');
          const telefoneCliente = cliente.telefone.replace(/\D/g, '');
          if (telefoneItem === telefoneCliente && telefoneItem.length >= 10) {
            console.log(`🔗 Associação por telefone: "${cliente.telefone}" -> "${item.whatsapp}"`);
            return true;
          }
        }
        
        return false;
      }) || [];
      
      // Calcular métricas DIRETAMENTE dos workflowItems
      const totalSessoes = clienteWorkflowItems.length;
      const totalFaturado = clienteWorkflowItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const totalPago = clienteWorkflowItems.reduce((sum, item) => sum + (Number(item.valorPago) || 0), 0);
      const aReceber = clienteWorkflowItems.reduce((sum, item) => sum + (Number(item.restante) || 0), 0);
      
      // Última sessão
      let ultimaSessao: string | null = null;
      if (clienteWorkflowItems.length > 0) {
        const datasOrdenadas = clienteWorkflowItems
          .map(item => item.dataOriginal instanceof Date ? item.dataOriginal : new Date(item.data))
          .filter(date => !isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        
        if (datasOrdenadas.length > 0) {
          ultimaSessao = datasOrdenadas[0].toLocaleDateString('pt-BR');
        }
      }
      
      console.log(`💰 Cliente "${cliente.nome}":`, {
        totalSessoes,
        totalFaturado,
        totalPago,
        aReceber,
        workflowItemsAssociados: clienteWorkflowItems.length
      });
      
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
  }, [clientes, workflowItems]);
};