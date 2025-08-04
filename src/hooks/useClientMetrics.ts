import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useUnifiedWorkflowData } from './useUnifiedWorkflowData';
import { validateClientMetrics } from '@/utils/validateClientMetrics';

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
  const { unifiedWorkflowData, workflowItems } = useUnifiedWorkflowData();
  
  // LOG APENAS QUANDO HÁ MUDANÇAS SIGNIFICATIVAS
  const hasData = clientes.length > 0 && unifiedWorkflowData.length > 0;
  if (hasData) {
    console.log('📊 CRM METRICS:', {
      clients: clientes.length,
      workflowData: unifiedWorkflowData.length
    });
  }
  
  const clientMetrics = useMemo(() => {
    // LOG APENAS EM DEBUG MODE OU PRIMEIRA EXECUÇÃO
    const debugMode = process.env.NODE_ENV === 'development';

    // Criar métricas usando EXATAMENTE a mesma lógica de "Pago" e "A Receber"
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO EXATO: clienteId OU nome (igual ao que funciona para pagamentos)
      const sessoesCliente = unifiedWorkflowData.filter(item => {
        const matchByClienteId = item.clienteId === cliente.id;
        const matchByName = !item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      });

      // LOG APENAS PARA CLIENTES ESPECÍFICOS EM DEBUG
      if (debugMode && (cliente.nome.toLowerCase().includes('eduardo') || cliente.nome.toLowerCase().includes('lise'))) {
        console.log(`🎯 CLIENT METRIC - ${cliente.nome}:`, {
          sessions: sessoesCliente.length,
          total: sessoesCliente.reduce((acc, s) => acc + (s.total || 0), 0)
        });
      }

      // CÁLCULO DIRETO - EXATAMENTE igual aos valores "Pago" e "A Receber" que funcionam
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.total === 'number' ? item.total : 0;
        return acc + valor;
      }, 0);
      const totalPago = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.valorPago === 'number' ? item.valorPago : 0;
        return acc + valor;
      }, 0);
      const aReceber = totalFaturado - totalPago;

      // LOG APENAS RESULTADOS RELEVANTES
      if (debugMode && totalFaturado > 0) {
        console.log(`✅ ${cliente.nome}: R$ ${totalFaturado} (${sessoes} sessões)`);
      }

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

    // LOG APENAS RESUMO FINAL
    if (debugMode) {
      const totalFaturadoGeral = metrics.reduce((acc, m) => acc + m.totalFaturado, 0);
      console.log('✅ CRM Metrics:', {
        activeClients: metrics.filter(m => m.sessoes > 0).length,
        totalRevenue: totalFaturadoGeral
      });
    }

    return metrics;
  }, [clientes, unifiedWorkflowData]); // Usar dados unificados como dependência

  return clientMetrics;
}