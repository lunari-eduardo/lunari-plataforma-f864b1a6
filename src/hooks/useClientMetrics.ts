import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

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
  const clientMetrics = useMemo(() => {
    // Carregar dados do workflow do localStorage
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    
    console.log('📊 Calculando métricas CRM:', {
      totalClientes: clientes.length,
      totalWorkflowItems: workflowItems.length
    });

    // Criar métricas para cada cliente
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // Filtrar sessões por cliente (comparação por nome)
      const sessoesCliente = workflowItems.filter(item => {
        const nomeNormalizado = item.nome?.toLowerCase().trim() || '';
        const clienteNormalizado = cliente.nome?.toLowerCase().trim() || '';
        return nomeNormalizado === clienteNormalizado;
      });

      // Calcular métricas
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

    console.log('✅ Métricas CRM calculadas:', {
      clientesComSessoes: metrics.filter(m => m.sessoes > 0).length,
      totalSessoes: metrics.reduce((acc, m) => acc + m.sessoes, 0),
      totalFaturado: metrics.reduce((acc, m) => acc + m.totalFaturado, 0)
    });

    return metrics;
  }, [clientes]);

  return clientMetrics;
}