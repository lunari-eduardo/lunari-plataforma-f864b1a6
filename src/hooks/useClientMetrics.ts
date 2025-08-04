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
    console.log('🎯 MÉTRICAS CRM - USANDO FONTE ÚNICA DE VERDADE (workflowItems):', {
      totalClientes: clientes.length,
      totalUnifiedWorkflowData: unifiedWorkflowData.length
    });

    // Criar métricas usando EXATAMENTE a mesma lógica de "Pago" e "A Receber"
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO EXATO: clienteId OU nome (igual ao que funciona para pagamentos)
      const sessoesCliente = unifiedWorkflowData.filter(item => {
        const matchByClienteId = item.clienteId === cliente.id;
        const matchByName = !item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      });

      console.log(`🎯 CLIENTE MÉTRICA - ${cliente.nome}:`, {
        clienteId: cliente.id,
        sessoesEncontradas: sessoesCliente.length,
        valoresDetalhados: sessoesCliente.map(s => ({
          id: s.id,
          nome: s.nome,
          total: s.total,
          valorPago: s.valorPago,
          fonte: s.fonte,
          clienteId: s.clienteId
        }))
      });

      // CÁLCULO DIRETO - EXATAMENTE igual aos valores "Pago" e "A Receber" que funcionam
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.total === 'number' ? item.total : 0;
        console.log(`  💰 Somando total para ${cliente.nome} - Item ${item.id}: R$ ${valor}`);
        return acc + valor;
      }, 0);
      const totalPago = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.valorPago === 'number' ? item.valorPago : 0;
        return acc + valor;
      }, 0);
      const aReceber = totalFaturado - totalPago;

      console.log(`✅ RESULTADO FINAL - ${cliente.nome}:`, {
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