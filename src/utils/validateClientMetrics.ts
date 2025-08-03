import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';

/**
 * Função de validação para verificar se as métricas de cliente estão corretas
 * Compara os resultados antigos vs. novos para garantir integridade
 */
export function validateClientMetrics(
  clientes: Cliente[],
  workflowItems: WorkflowItem[],
  unifiedWorkflowData: WorkflowItem[]
) {
  console.log('🔍 === VALIDAÇÃO DE MÉTRICAS CRM ===');
  
  const relatorioValidacao = {
    totalClientes: clientes.length,
    workflowItemsOriginal: workflowItems.length,
    unifiedWorkflowData: unifiedWorkflowData.length,
    clientesComClienteId: 0,
    clientesSemClienteId: 0,
    clientesComDados: 0,
    clientesSemDados: 0,
    detalhes: [] as any[]
  };

  clientes.forEach(cliente => {
    // Método 1: Filtro apenas por clienteId (método desejado)
    const sessoesClienteId = unifiedWorkflowData.filter(item => 
      item.clienteId === cliente.id
    );

    // Método 2: Filtro por nome (fallback)
    const sessoesNome = unifiedWorkflowData.filter(item => 
      item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
    );

    // Método 3: Filtro combinado (atual)
    const sessoesCombinado = unifiedWorkflowData.filter(item => {
      const matchByClienteId = item.clienteId === cliente.id;
      const matchByName = item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });

    const totalFaturadoClienteId = sessoesClienteId.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalFaturadoNome = sessoesNome.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalFaturadoCombinado = sessoesCombinado.reduce((acc, item) => acc + (item.total || 0), 0);

    const detalheCliente = {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      metodo1_clienteId: {
        sessoes: sessoesClienteId.length,
        totalFaturado: totalFaturadoClienteId
      },
      metodo2_nome: {
        sessoes: sessoesNome.length,
        totalFaturado: totalFaturadoNome
      },
      metodo3_combinado: {
        sessoes: sessoesCombinado.length,
        totalFaturado: totalFaturadoCombinado
      },
      temClienteIdCorreto: sessoesClienteId.length > 0,
      temDadosGerais: sessoesCombinado.length > 0
    };

    relatorioValidacao.detalhes.push(detalheCliente);

    if (sessoesClienteId.length > 0) {
      relatorioValidacao.clientesComClienteId++;
    } else {
      relatorioValidacao.clientesSemClienteId++;
    }

    if (sessoesCombinado.length > 0) {
      relatorioValidacao.clientesComDados++;
    } else {
      relatorioValidacao.clientesSemDados++;
    }
  });

  // Verificar quantos workflowItems têm clienteId
  const itemsComClienteId = unifiedWorkflowData.filter(item => item.clienteId);
  const itemsSemClienteId = unifiedWorkflowData.filter(item => !item.clienteId);

  console.log('📊 RELATÓRIO DE VALIDAÇÃO:', relatorioValidacao);
  console.log('🆔 WorkflowItems com clienteId:', itemsComClienteId.length);
  console.log('❌ WorkflowItems sem clienteId:', itemsSemClienteId.length);

  // Amostras de debugging
  if (itemsSemClienteId.length > 0) {
    console.log('🔍 Amostra de items sem clienteId:', 
      itemsSemClienteId.slice(0, 3).map(item => ({
        id: item.id,
        nome: item.nome,
        fonte: item.fonte,
        clienteId: item.clienteId
      }))
    );
  }

  if (relatorioValidacao.clientesSemDados > 0) {
    console.log('⚠️ Clientes sem dados:', 
      relatorioValidacao.detalhes
        .filter(d => !d.temDadosGerais)
        .map(d => ({ nome: d.clienteNome, id: d.clienteId }))
    );
  }

  return relatorioValidacao;
}