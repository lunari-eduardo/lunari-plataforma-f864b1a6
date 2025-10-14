import { useState, useMemo, useEffect } from 'react';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useClientMetricsRealtime } from '@/hooks/useClientMetricsRealtime';

export function useClientDetails(clienteId: string | undefined) {
  const { 
    clientes, 
    isLoading: clientesLoading, 
    atualizarClienteCompleto,
    getClienteById 
  } = useClientesRealtime();
  const { metrics, loading: metricsLoading } = useClientMetricsRealtime(clienteId || '');
  const [isLoading, setIsLoading] = useState(true);

  // Encontrar o cliente completo pelo ID (com família e documentos)
  const cliente = useMemo(() => {
    if (!clienteId) return null;
    return getClienteById(clienteId) || null;
  }, [clienteId, getClienteById]);

  // Loading state management
  useEffect(() => {
    setIsLoading(clientesLoading || metricsLoading);
  }, [clientesLoading, metricsLoading]);

  // Função para atualizar cliente completo (incluindo família)
  const atualizarCliente = async (id: string, dadosAtualizados: any) => {
    try {
      await atualizarClienteCompleto(id, dadosAtualizados);
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