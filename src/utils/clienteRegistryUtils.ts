/**
 * Utilitários para Cliente Registry
 * Hook e funções auxiliares para usar o novo sistema de dados centralizados
 */

import { useState, useEffect } from 'react';
import { ClienteRelationshipManager } from '@/services/ClienteRelationshipManager';
import { ClienteRegistryMap, ClienteRegistry } from '@/types/cliente';
import { Cliente } from '@/types/orcamentos';

/**
 * Hook para usar dados do Cliente Registry
 */
export function useClienteRegistry() {
  const [registry, setRegistry] = useState<ClienteRegistryMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inicializar o sistema e carregar dados
    ClienteRelationshipManager.initialize();
    const allRegistries = ClienteRelationshipManager.getAllClientesRegistry();
    setRegistry(allRegistries);
    setLoading(false);
  }, []);

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
    ClienteRelationshipManager.recalculateAllMetrics();
    const updatedRegistries = ClienteRelationshipManager.getAllClientesRegistry();
    setRegistry(updatedRegistries);
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