import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';

export interface ClienteWithMetricas extends Cliente {
  metricas: {
    totalSessoes: number;
    totalFaturado: number;
    totalPago: number;
    aReceber: number;
    ultimaSessao: string | null;
  };
}

export const useClienteMetrics = (clientes: Cliente[], workflowItems: WorkflowItem[]): ClienteWithMetricas[] => {
  return useMemo(() => {
    console.log('🔄 NOVA ARQUITETURA CRM - Calculando métricas exclusivamente do workflow:', {
      clientesLength: clientes?.length || 0,
      workflowItemsLength: workflowItems?.length || 0
    });

    // Se não há dados, retornar lista vazia
    if (!clientes || clientes.length === 0) {
      console.log('⚠️ Sem clientes para processar');
      return [];
    }

    return clientes.map(cliente => {
      // FONTE ÚNICA DE VERDADE: Filtrar workflowItems por clienteId
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
      
      // CÁLCULO EM TEMPO REAL: Métricas EXCLUSIVAMENTE dos workflowItems
      const totalSessoes = clienteWorkflowItems.length;
      const totalFaturado = clienteWorkflowItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalPago = clienteWorkflowItems.reduce((sum, item) => sum + (item.valorPago || 0), 0);
      const aReceber = clienteWorkflowItems.reduce((sum, item) => sum + (item.restante || 0), 0);
      
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
      
      console.log(`💰 Cliente "${cliente.nome}" - MÉTRICAS EM TEMPO REAL:`, {
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