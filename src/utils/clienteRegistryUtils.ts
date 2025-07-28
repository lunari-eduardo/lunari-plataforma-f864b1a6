/**
 * Utilitários para Cliente Registry
 * Hook e funções auxiliares para usar o novo sistema de dados centralizados
 */

import { useState, useEffect } from 'react';
import { ClienteRelationshipManager } from '@/services/ClienteRelationshipManager';
import { ClienteRegistryMap, ClienteRegistry } from '@/types/cliente';
import { Cliente } from '@/types/orcamentos';
import { useAppContext } from '@/contexts/AppContext';

/**
 * Hook para usar dados do Cliente Registry
 */
export function useClienteRegistry() {
  const [registry, setRegistry] = useState<ClienteRegistryMap>({});
  const [loading, setLoading] = useState(true);
  const context = useAppContext();

  useEffect(() => {
    console.log('🔧 useClienteRegistry: Verificando disponibilidade do contexto...');
    
    // Só inicializar se o contexto estiver disponível e os dados carregados
    if (!context) {
      console.log('⚠️ useClienteRegistry: Contexto não disponível ainda');
      return;
    }

    if (context.orcamentos === undefined || context.appointments === undefined || context.workflowItems === undefined) {
      console.log('⚠️ useClienteRegistry: Dados do contexto ainda não carregados');
      return;
    }

    console.log('✅ useClienteRegistry: Contexto disponível, inicializando ClienteRelationshipManager');
    
    try {
      // Inicializar o sistema e carregar dados
      ClienteRelationshipManager.initialize();
      const allRegistries = ClienteRelationshipManager.getAllClientesRegistry();
      setRegistry(allRegistries);
      setLoading(false);
      console.log('✅ useClienteRegistry: Registry carregado com sucesso');
    } catch (error) {
      console.error('❌ useClienteRegistry: Erro ao inicializar:', error);
      setLoading(false);
    }
  }, [context]);

  const getClienteMetricas = (clienteId: string) => {
    const clienteRegistry = registry[clienteId];
    return clienteRegistry?.metricas || {
      totalSessoes: 0,
      totalGasto: 0,
      totalPago: 0,
      aReceber: 0,
      ultimaSessao: null,
      primeiroContato: null,
      statusFinanceiro: 'em_dia' as const
    };
  };

  const refreshRegistry = () => {
    console.log('🔄 Forçando refresh do registry...');
    ClienteRelationshipManager.recalculateAllMetrics();
    const updatedRegistries = ClienteRelationshipManager.getAllClientesRegistry();
    setRegistry(updatedRegistries);
    console.log('✅ Registry atualizado:', Object.keys(updatedRegistries).length, 'clientes');
  };

  return {
    registry,
    loading,
    getClienteMetricas,
    refreshRegistry
  };
}

/**
 * Converte lista de clientes para usar com o registry
 */
export function prepareClientesWithMetricas(clientes: Cliente[], registry: ClienteRegistryMap) {
  return clientes.map(cliente => {
    const clienteRegistry = registry[cliente.id];
    return {
      ...cliente,
      metricas: clienteRegistry?.metricas || {
        totalSessoes: 0,
        totalGasto: 0,
        totalPago: 0,
        aReceber: 0,
        ultimaSessao: null,
        primeiroContato: null,
        statusFinanceiro: 'em_dia' as const
      }
    };
  });
}

/**
 * Força sincronização do registry com dados atuais
 */
export function syncClienteRegistry() {
  ClienteRelationshipManager.recalculateAllMetrics();
}

/**
 * Obtém estatísticas consolidadas do registry
 */
export function getRegistryStats() {
  return ClienteRelationshipManager.getRegistryStats();
}