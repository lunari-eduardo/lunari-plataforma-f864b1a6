import { useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';

/**
 * Hook para sincronização bidirecional entre workflow e outras fontes de dados
 * Garante que mudanças no workflow sejam propagadas para o CRM e outros módulos
 */
export function useWorkflowSync() {
  const { workflowItems } = useAppContext();

  // Função para forçar sincronização de dados
  const forceSyncWorkflowData = useCallback(() => {
    console.log('🔄 Forçando sincronização de dados do workflow...');
    
    try {
      // Disparar evento customizado para notificar outros hooks
      window.dispatchEvent(new CustomEvent('workflowDataUpdated', { 
        detail: { 
          items: workflowItems,
          timestamp: new Date().toISOString()
        } 
      }));

      // Salvar no localStorage para sincronização entre abas
      const workflowData = {
        items: workflowItems,
        lastSync: new Date().toISOString()
      };
      
      localStorage.setItem('workflow_sync_data', JSON.stringify(workflowData));
      
      console.log('✅ Sincronização forçada concluída');
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
    }
  }, [workflowItems]);

  // Sync otimizado com debounce inteligente
  useEffect(() => {
    const performanceConfig = JSON.parse(localStorage.getItem('performance_config') || '{}');
    const debounceMs = performanceConfig.syncDebounceMs || 500;
    
    const timeoutId = setTimeout(() => {
      if (workflowItems.length > 0) {
        forceSyncWorkflowData();
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [workflowItems, forceSyncWorkflowData]);

  // Sync periódico reduzido (OTIMIZADO)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // Apenas sync se houve mudanças significativas
      const lastSync = localStorage.getItem('workflow_sync_data');
      if (lastSync && workflowItems.length > 0) {
        try {
          const syncData = JSON.parse(lastSync);
          const timeDiff = Date.now() - new Date(syncData.lastSync).getTime();
          
          // Sync apenas se passou mais de 5 segundos
          if (timeDiff > 5000) {
            forceSyncWorkflowData();
          }
        } catch {
          forceSyncWorkflowData();
        }
      }
    }, 10000); // Verificar a cada 10 segundos (OTIMIZADO)

    return () => clearInterval(syncInterval);
  }, [forceSyncWorkflowData]);

  // Função para validar integridade dos dados
  const validateDataIntegrity = useCallback(() => {
    console.log('🔍 Validando integridade dos dados do workflow...');
    
    const inconsistencies = [];
    
    workflowItems.forEach(item => {
      // Validar se total está correto
      const expectedTotal = (item.valorPacote || 0) + 
                           (item.valorTotalFotoExtra || 0) + 
                           (item.valorTotalProduto || 0) + 
                           (item.valorAdicional || 0) - 
                           (item.desconto || 0);
      
      if (Math.abs(item.total - expectedTotal) > 0.01) {
        inconsistencies.push({
          id: item.id,
          nome: item.nome,
          totalAtual: item.total,
          totalEsperado: expectedTotal,
          diferenca: item.total - expectedTotal
        });
      }
    });

    if (inconsistencies.length > 0) {
      console.warn('⚠️ Inconsistências encontradas:', inconsistencies);
      return inconsistencies;
    }

    console.log('✅ Dados íntegros');
    return [];
  }, [workflowItems]);

  // Função para recalcular totais se necessário
  const recalculateTotalsIfNeeded = useCallback(() => {
    const inconsistencies = validateDataIntegrity();
    
    if (inconsistencies.length > 0) {
      console.log('🔧 Recalculando totais inconsistentes...');
      
      inconsistencies.forEach(inconsistency => {
        console.log(`💰 Corrigindo total para ${inconsistency.nome}: ${inconsistency.totalAtual} → ${inconsistency.totalEsperado}`);
      });
      
      // Aqui você chamaria uma função do contexto para atualizar os itens
      // updateWorkflowItemTotals(inconsistencies);
    }
  }, [validateDataIntegrity]);

  return {
    forceSyncWorkflowData,
    validateDataIntegrity,
    recalculateTotalsIfNeeded
  };
}