import { useState, useMemo, useEffect } from 'react';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useClientMetricsRealtime } from '@/hooks/useClientMetricsRealtime';
import { ClienteSupabase } from '@/types/cliente-supabase';

export function useClientDetails(clienteId: string | undefined) {
  const { clientes, isLoading: clientesLoading, atualizarCliente: updateCliente } = useClientesRealtime();
  const { metrics, loading: metricsLoading } = useClientMetricsRealtime(clienteId || '');
  const [isLoading, setIsLoading] = useState(true);

  // Encontrar o cliente pelo ID
  const cliente = useMemo(() => {
    if (!clienteId) return null;
    return clientes.find(c => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  // Loading state management
  useEffect(() => {
    setIsLoading(clientesLoading || metricsLoading);
  }, [clientesLoading, metricsLoading]);

  // Função para atualizar cliente
  const atualizarCliente = async (id: string, dadosAtualizados: any) => {
    try {
      await updateCliente(id, dadosAtualizados);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  };

  return {
    cliente,
    metricas: metrics,
    isLoading,
    atualizarCliente
  };
}