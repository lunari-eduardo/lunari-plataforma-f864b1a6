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
    console.log('🔥 SIMPLIFICAÇÃO CRM - Usando mesma lógica de Pago/A Receber:', {
      totalClientes: clientes.length,
      totalUnifiedWorkflowData: unifiedWorkflowData.length
    });

    // Criar métricas para cada cliente usando lógica DIRETA (igual Pago/A Receber)
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO SIMPLIFICADO: clienteId OU nome (sem fallbacks complexos)
      const sessoesCliente = unifiedWorkflowData.filter(item => {
        return item.clienteId === cliente.id || 
               (!item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim());
      });

      console.log(`💰 CRM SIMPLIFICADO - ${cliente.nome}:`, {
        clienteId: cliente.id,
        sessoesEncontradas: sessoesCliente.length,
        valores: sessoesCliente.map(s => ({
          id: s.id,
          total: s.total,
          valorPago: s.valorPago,
          fonte: s.fonte
        }))
      });

      // CÁLCULO DIRETO (mesma lógica que funciona para Pago/A Receber)
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => {
        const valor = item.total || 0;
        console.log(`  📊 Somando faturado ${item.id}: R$ ${valor}`);
        return acc + valor;
      }, 0);
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