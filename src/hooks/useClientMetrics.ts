import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
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
  // SIMPLIFICADO PÓS-MIGRAÇÃO: Usar AppContext como fonte única
  const { workflowItems } = useAppContext();

  // Função para converter valores monetários
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const clientMetrics = useMemo(() => {
    const debugMode = process.env.NODE_ENV === 'development';

    // SIMPLIFICADO PÓS-MIGRAÇÃO: usar workflowItems diretamente
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO: associar por clienteId OU nome
      const workflowDoCliente = workflowItems.filter(item => {
        const matchByClienteId = item.clienteId === cliente.id;
        const matchByName = !item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      });

      // CÁLCULOS usando valores diretos de workflowItems
      const sessoes = workflowDoCliente.length;
      const totalFaturado = workflowDoCliente.reduce((acc, item) => acc + (item.total || 0), 0);
      const totalPago = workflowDoCliente.reduce((acc, item) => acc + (item.valorPago || 0), 0);
      const aReceber = totalFaturado - totalPago;

      // LOG para debug
      if (debugMode && totalFaturado > 0) {
        console.log(`💰 ${cliente.nome}: Total R$ ${totalFaturado.toFixed(2)} | Pago R$ ${totalPago.toFixed(2)} | A Receber R$ ${aReceber.toFixed(2)}`);
      }

      // Encontrar última sessão
      let ultimaSessao: Date | null = null;
      if (workflowDoCliente.length > 0) {
        const datasOrdenadas = workflowDoCliente
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

    // LOG resumo final
    if (debugMode && workflowItems.length > 0) {
      const totalGeral = metrics.reduce((acc, m) => acc + m.totalFaturado, 0);
      console.log('✅ CRM METRICS (PÓS-MIGRAÇÃO):', {
        clientesComSessoes: metrics.filter(m => m.sessoes > 0).length,
        totalFaturamento: totalGeral.toFixed(2)
      });
    }

    return metrics;
  }, [clientes, workflowItems]);

  return clientMetrics;
}