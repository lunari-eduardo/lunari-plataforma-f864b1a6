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
    // Debug: mostrar dados recebidos
    console.log('🔍 useClienteMetrics - Debug completo:', {
      totalClientes: clientes?.length || 0,
      totalWorkflowItems: workflowItems?.length || 0,
      clientes: clientes?.map(c => ({ id: c.id, nome: c.nome })),
      workflowSample: workflowItems?.slice(0, 3).map(w => ({ 
        id: w.id, 
        clienteId: w.clienteId, 
        nome: w.nome,
        total: w.total,
        valorPago: w.valorPago 
      }))
    });

    return clientes.map(cliente => {
      // Filtrar todos os workflowItems deste cliente específico
      // LÓGICA ROBUSTA: Primeiro tenta por clienteId, depois por nome/telefone como fallback
      const clienteWorkflowItems = workflowItems.filter(item => {
        // Prioridade 1: Match direto por clienteId
        if (item.clienteId === cliente.id) {
          return true;
        }
        
        // Prioridade 2: Fallback por nome exato (case insensitive)
        if (item.nome && cliente.nome) {
          const nomeItemNormalizado = item.nome.toLowerCase().trim();
          const nomeClienteNormalizado = cliente.nome.toLowerCase().trim();
          if (nomeItemNormalizado === nomeClienteNormalizado) {
            return true;
          }
        }
        
        // Prioridade 3: Fallback por telefone (apenas números)
        if (item.whatsapp && cliente.telefone) {
          const telefoneItem = item.whatsapp.replace(/\D/g, '');
          const telefoneCliente = cliente.telefone.replace(/\D/g, '');
          if (telefoneItem === telefoneCliente && telefoneItem.length >= 10) {
            return true;
          }
        }
        
        return false;
      });
      
      // Debug: mostrar associações
      console.log(`🔗 Cliente "${cliente.nome}" (ID: ${cliente.id}):`, {
        workflowItemsEncontrados: clienteWorkflowItems.length,
        workflowItems: clienteWorkflowItems.map(w => ({ 
          id: w.id, 
          clienteId: w.clienteId, 
          total: w.total,
          valorPago: w.valorPago
        }))
      });
      
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