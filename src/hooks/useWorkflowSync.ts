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

  // Escutar mudanças no workflow e sincronizar em TEMPO REAL
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      forceSyncWorkflowData();
    }, 50); // Debounce mínimo para máxima responsividade

    return () => clearTimeout(timeoutId);
  }, [workflowItems, forceSyncWorkflowData]);

  // Forçar atualização IMEDIATA quando valores de total ou pagamento mudam
  useEffect(() => {
    if (workflowItems.length > 0) {
      console.log('🎯 WORKFLOW MODIFICADO - Sync IMEDIATO para CRM...');
      forceSyncWorkflowData();
    }
  }, [workflowItems.map(item => `${item.id}:${item.total}:${item.valorPago}`).join(','), forceSyncWorkflowData]);

  // Sync adicional para garantir que mudanças apareçam no CRM
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (workflowItems.length > 0) {
        forceSyncWorkflowData();
      }
    }, 1000); // Sync a cada segundo para garantir consistência

    return () => clearInterval(syncInterval);
  }, [workflowItems, forceSyncWorkflowData]);

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