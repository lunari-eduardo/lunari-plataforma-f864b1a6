import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem, useAppContext } from '@/contexts/AppContext';

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

/**
 * 🎯 SOLUÇÃO DEFINITIVA: CRM usando workflowItems como ÚNICA fonte de verdade
 * 
 * ARQUITETURA SIMPLIFICADA:
 * - Lê APENAS de workflowItems (AppContext)
 * - Filtra por clienteId (ligação direta)
 * - Calcula métricas diretamente (sem camadas intermediárias)
 * - ZERO dependências de useUnifiedWorkflowData ou workflow_sessions
 */
export function useClientMetrics(clientes: Cliente[]) {
  const { workflowItems } = useAppContext();
  
  console.log('🚀 CRM MÉTRICAS - FONTE ÚNICA DE VERDADE (workflowItems):', {
    totalClientes: clientes.length,
    totalWorkflowItems: workflowItems.length,
    amostrawWorkflowItems: workflowItems.slice(0, 3).map(item => ({
      id: item.id,
      nome: item.nome,
      total: item.total,
      valorPago: item.valorPago,
      clienteId: item.clienteId
    }))
  });
  
  const clientMetrics = useMemo(() => {
    console.log('🎯 INICIANDO CÁLCULO DE MÉTRICAS CRM...');

    // LÓGICA DEFINITIVA: Para cada cliente, filtrar workflowItems por clienteId
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      console.log(`\n🔍 PROCESSANDO CLIENTE: ${cliente.nome} (ID: ${cliente.id})`);

      // FILTRO DIRETO E SIMPLES: clienteId === cliente.id
      const sessoesCliente = workflowItems.filter(item => {
        const matchByClienteId = item.clienteId === cliente.id;
        
        // Fallback APENAS para itens antigos sem clienteId (compatibilidade)
        const matchByName = !item.clienteId && 
          item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        
        const isMatch = matchByClienteId || matchByName;
        
        if (isMatch) {
          console.log(`  ✅ SESSÃO ENCONTRADA: ${item.id} - ${item.nome} - R$ ${item.total || 0} (clienteId: ${item.clienteId || 'NOME'})`);
        }
        
        return isMatch;
      });

      console.log(`📊 RESULTADO FILTRO - ${cliente.nome}:`, {
        sessõesEncontradas: sessoesCliente.length,
        ids: sessoesCliente.map(s => s.id)
      });

      // CÁLCULOS DIRETOS (idênticos ao que funciona na tabela Workflow)
      const sessoes = sessoesCliente.length;
      
      const totalFaturado = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.total === 'number' && !isNaN(item.total) ? item.total : 0;
        console.log(`  💰 TOTAL - ${item.id}: R$ ${valor}`);
        return acc + valor;
      }, 0);
      
      const totalPago = sessoesCliente.reduce((acc, item) => {
        const valor = typeof item.valorPago === 'number' && !isNaN(item.valorPago) ? item.valorPago : 0;
        console.log(`  💵 PAGO - ${item.id}: R$ ${valor}`);
        return acc + valor;
      }, 0);
      
      const aReceber = totalFaturado - totalPago;

      // Última sessão
      let ultimaSessao: Date | null = null;
      if (sessoesCliente.length > 0) {
        const datasValidas = sessoesCliente
          .map(item => new Date(item.data))
          .filter(data => !isNaN(data.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        
        if (datasValidas.length > 0) {
          ultimaSessao = datasValidas[0];
        }
      }

      console.log(`✅ MÉTRICAS FINAIS - ${cliente.nome}:`, {
        sessoes,
        totalFaturado,
        totalPago,
        aReceber,
        ultimaSessao: ultimaSessao?.toLocaleDateString()
      });

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

    // Relatório final
    const totalSessoes = metrics.reduce((acc, m) => acc + m.sessoes, 0);
    const totalFaturadoGeral = metrics.reduce((acc, m) => acc + m.totalFaturado, 0);
    const totalPagoGeral = metrics.reduce((acc, m) => acc + m.totalPago, 0);

    console.log('🎊 RELATÓRIO FINAL CRM MÉTRICAS:', {
      clientesProcessados: metrics.length,
      clientesComSessoes: metrics.filter(m => m.sessoes > 0).length,
      totalSessoes,
      totalFaturadoGeral,
      totalPagoGeral,
      totalAReceberGeral: totalFaturadoGeral - totalPagoGeral
    });

    // Debug específico para clientes mencionados
    const eduardo = metrics.find(m => m.nome.toLowerCase().includes('eduardo'));
    const lise = metrics.find(m => m.nome.toLowerCase().includes('lise'));
    
    if (eduardo) {
      console.log('🔍 EDUARDO (DEBUG):', eduardo);
    }
    if (lise) {
      console.log('🔍 LISE (DEBUG):', lise);
    }

    return metrics;
  }, [clientes, workflowItems]); // Dependência APENAS dos workflowItems

  return clientMetrics;
}