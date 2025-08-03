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
  
  console.log('📊 INÍCIO CÁLCULO MÉTRICAS CRM - DADOS RECEBIDOS:', {
    totalClientes: clientes.length,
    totalUnifiedWorkflowData: unifiedWorkflowData.length,
    amostraUnifiedData: unifiedWorkflowData.slice(0, 3).map(item => ({
      id: item.id,
      nome: item.nome,
      total: item.total,
      valorPago: item.valorPago,
      fonte: item.fonte
    }))
  });
  
  const clientMetrics = useMemo(() => {
    console.log('📊 Calculando métricas CRM:', {
      totalClientes: clientes.length,
      totalUnifiedWorkflowData: unifiedWorkflowData.length
    });

    // Executar validação completa
    validateClientMetrics(clientes, workflowItems, unifiedWorkflowData);

    // Criar métricas para cada cliente
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO RIGOROSO: Priorizar clienteId, fallback por nome normalizado
      const sessoesCliente = unifiedWorkflowData.filter(item => {
        // Primeira prioridade: clienteId exato
        if (item.clienteId === cliente.id) {
          return true;
        }
        
        // Segunda prioridade: Match por nome normalizado (apenas se não houver clienteId)
        if (!item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });

      console.log(`💰 Calculando métricas para cliente ${cliente.nome}:`, {
        clienteId: cliente.id,
        sessoesEncontradas: sessoesCliente.length,
        sessoesDetalhes: sessoesCliente.map(s => ({
          id: s.id,
          fonte: s.fonte,
          total: s.total,
          valorPago: s.valorPago
        }))
      });

      // Calcular métricas baseadas na lista filtrada de "trabalhos do cliente"
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => acc + (item.total || 0), 0);
      const totalPago = sessoesCliente.reduce((acc, item) => acc + (item.valorPago || 0), 0);
      const aReceber = totalFaturado - totalPago;

      console.log(`✅ Métricas ${cliente.nome}:`, {
        sessoes,
        totalFaturado,
        totalPago,
        aReceber
      });

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
  }, [clientes, unifiedWorkflowData]); // Usar dados unificados como dependência

  return clientMetrics;
}