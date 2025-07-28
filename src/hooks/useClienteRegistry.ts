/**
 * Hook para usar o Cliente Registry System
 */

import { useState, useEffect } from 'react';
import { clienteRegistry, ClienteRegistryData } from '@/services/ClienteRegistry';

export const useClienteRegistry = () => {
  const [clientes, setClientes] = useState<ClienteRegistryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sincronizar dados na inicialização
    clienteRegistry.syncAll();
    setClientes(clienteRegistry.getAllClientes());
    setLoading(false);

    // Adicionar listener para mudanças
    const unsubscribe = clienteRegistry.addListener(() => {
      setClientes(clienteRegistry.getAllClientes());
    });

    return unsubscribe;
  }, []);

  const syncData = () => {
    clienteRegistry.onDataChange();
  };

  const getClienteById = (id: string) => {
    return clienteRegistry.getClienteData(id);
  };

  const getStats = () => {
    return clienteRegistry.getStats();
  };

  return {
    clientes,
    loading,
    syncData,
    getClienteById,
    getStats
  };
};