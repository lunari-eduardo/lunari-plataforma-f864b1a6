import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { useAppContext } from '@/contexts/AppContext';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  sessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: Date | null;
}

export function useClientMetrics(clientes: Cliente[]) {
  const { workflowItems } = useAppContext();
  
  const clientMetrics = useMemo(() => {
    // FONTE ÚNICA: workflowItems do AppContext (após migração)
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // Filtro por clienteId APENAS (sem fallback de nome)
      const sessoesCliente = workflowItems.filter(item => item.clienteId === cliente.id);

      // Cálculo direto das métricas
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => acc + (item.total || 0), 0);
      const totalPago = sessoesCliente.reduce((acc, item) => acc + (item.valorPago || 0), 0);
      const aReceber = totalFaturado - totalPago;

      // Encontrar última sessão
      let ultimaSessao: Date | null = null;
      if (sessoesCliente.length > 0) {
        const datasOrdenadas = sessoesCliente
          .map(item => new Date(item.data))
          .filter(data => !isNaN(data.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        
        if (datasOrdenadas.length > 0) {
          ultimaSessao = datasOrdenadas[0];
        }
      }

      return {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        sessoes,
        totalFaturado,
        totalPago,
        aReceber,
        ultimaSessao
      };
    });

    return metrics;
  }, [clientes, workflowItems]);

  return clientMetrics;
}