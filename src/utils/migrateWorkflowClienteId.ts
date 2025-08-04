import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';

/**
 * Migração MELHORADA para adicionar clienteId aos workflowItems existentes
 * - Unifica dados de múltiplas fontes
 * - Força execução se dados inconsistentes
 * - Consolida para fonte única de verdade
 */
export function migrateWorkflowClienteId() {
  try {
    const MIGRATION_KEY = 'workflow_clienteId_migrated_v2';
    
    console.log('🚀 Iniciando migração MELHORADA de clienteId...');

    // Carregar dados de TODAS as fontes
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    console.log('📊 Dados para migração:', {
      workflowItems: workflowItems.length,
      clientes: clientes.length,
      workflowSessions: workflowSessions.length
    });

    // FASE 1: Consolidar dados de workflow_sessions para workflowItems
    const allWorkflowItems = new Map<string, WorkflowItem>();
    
    // Primeiro, adicionar workflowItems existentes
    workflowItems.forEach(item => {
      allWorkflowItems.set(item.id, item);
    });
    
    // Depois, adicionar dados de sessions que não existem como workflowItems
    workflowSessions.forEach((session: any) => {
      if (!allWorkflowItems.has(session.id)) {
        // Converter session para WorkflowItem
        const parseValue = (value: string | number): number => {
          if (typeof value === 'number') return value;
          if (!value) return 0;
          const cleanValue = value.toString().replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
          return parseFloat(cleanValue) || 0;
        };

        const workflowItem: WorkflowItem = {
          id: session.id,
          data: session.data || '',
          hora: session.hora || '',
          nome: session.nome || '',
          whatsapp: session.whatsapp || '',
          email: session.email || '',
          descricao: session.descricao || '',
          status: session.status || '',
          categoria: session.categoria || '',
          pacote: session.pacote || '',
          valorPacote: parseValue(session.valorPacote || session.valor),
          desconto: session.desconto || 0,
          valorFotoExtra: parseValue(session.valorFotoExtra),
          qtdFotoExtra: session.qtdFotosExtra || 0,
          valorTotalFotoExtra: parseValue(session.valorTotalFotoExtra),
          produto: session.produto || '',
          qtdProduto: session.qtdProduto || 0,
          valorTotalProduto: parseValue(session.valorTotalProduto),
          produtosList: session.produtosList || [],
          valorAdicional: parseValue(session.valorAdicional),
          detalhes: session.detalhes || '',
          total: parseValue(session.total || session.valor),
          valorPago: parseValue(session.valorPago),
          restante: parseValue(session.restante),
          pagamentos: session.pagamentos || [],
          fonte: session.fonte || 'agenda',
          dataOriginal: session.dataOriginal ? new Date(session.dataOriginal) : new Date(session.data),
          clienteId: session.clienteId // Manter se já existir
        };
        
        allWorkflowItems.set(session.id, workflowItem);
        console.log(`📦 Consolidado session órfã: ${session.id}`);
      }
    });

    // FASE 2: Aplicar clienteId para TODOS os itens
    let itemsAtualizados = 0;
    const workflowItemsFinais = Array.from(allWorkflowItems.values()).map(item => {
      // Se já tem clienteId válido, manter
      if (item.clienteId && clientes.find(c => c.id === item.clienteId)) {
        return item;
      }

      // Buscar cliente por nome
      const clienteEncontrado = clientes.find(cliente => 
        cliente.nome.toLowerCase().trim() === item.nome.toLowerCase().trim()
      );

      if (clienteEncontrado) {
        itemsAtualizados++;
        console.log(`✅ ClienteId adicionado: ${item.nome} → ${clienteEncontrado.id}`);
        return {
          ...item,
          clienteId: clienteEncontrado.id
        };
      }

      console.warn(`⚠️ Cliente não encontrado para: ${item.nome} (ID: ${item.id})`);
      return item;
    });

    // FASE 3: Salvar dados consolidados
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItemsFinais);
    
    // FASE 4: Limpar workflow_sessions (dados já consolidados)
    localStorage.removeItem('workflow_sessions');
    
    // Marcar migração como concluída
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log('✅ Migração MELHORADA concluída:', {
      workflowItemsFinais: workflowItemsFinais.length,
      itemsComClienteId: workflowItemsFinais.filter(i => i.clienteId).length,
      itemsAtualizados,
      sessionsConsolidadas: workflowSessions.length
    });

    return true;

  } catch (error) {
    console.error('❌ Erro durante migração MELHORADA:', error);
    return false;
  }
}