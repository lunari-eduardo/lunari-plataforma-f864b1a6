import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

/**
 * CRM SIMPLIFICADO - APENAS DADOS BÁSICOS DOS CLIENTES
 * Sem métricas financeiras, sem histórico, sem cálculos
 */
export function useClientMetrics(clientes: Cliente[]) {
  const clientMetrics = useMemo(() => {
    return clientes.map(cliente => ({
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone
    }));
  }, [clientes]);

  return clientMetrics;
}