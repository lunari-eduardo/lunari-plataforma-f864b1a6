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
  
  console.log('📊 FONTE ÚNICA DE VERDADE - CRM Usando workflowItems do AppContext:', {
    totalClientes: clientes.length,
    totalWorkflowItems: workflowItems.length
  });
  
  const clientMetrics = useMemo(() => {
    console.log('🎯 MÉTRICAS CRM - CÁLCULO DIRETO COM FONTE AUTORITATIVA');

    // Criar métricas usando APENAS workflowItems (fonte única de verdade)
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO SIMPLIFICADO: APENAS clienteId (sem fallback de nome)
      const sessoesCliente = workflowItems.filter(item => item.clienteId === cliente.id);

      console.log(`🎯 CLIENTE MÉTRICA SIMPLES - ${cliente.nome}:`, {
        clienteId: cliente.id,
        sessoesEncontradas: sessoesCliente.length,
        valoresDetalhados: sessoesCliente.map(s => ({
          id: s.id,
          nome: s.nome,
          total: s.total,
          valorPago: s.valorPago,
          clienteId: s.clienteId
        }))
      });

      // CÁLCULO DIRETO
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, item) => acc + (item.total || 0), 0);
      const totalPago = sessoesCliente.reduce((acc, item) => acc + (item.valorPago || 0), 0);
      const aReceber = totalFaturado - totalPago;

      console.log(`✅ RESULTADO FINAL SIMPLIFICADO - ${cliente.nome}:`, {
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

    console.log('✅ Métricas CRM SIMPLIFICADAS calculadas:', {
      clientesComSessoes: metrics.filter(m => m.sessoes > 0).length,
      totalSessoes: metrics.reduce((acc, m) => acc + m.sessoes, 0),
      totalFaturado: metrics.reduce((acc, m) => acc + m.totalFaturado, 0)
    });

    return metrics;
  }, [clientes, workflowItems]); // Dependência direta dos workflowItems

  return clientMetrics;
}