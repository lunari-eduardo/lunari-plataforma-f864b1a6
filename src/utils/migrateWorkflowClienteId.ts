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
    const MIGRATION_KEY = 'workflow_clienteId_migrated_v3_unified';
    
    // Verificar se já foi executada
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      console.log('🎯 Migração já executada, pulando...');
      return true;
    }
    
    console.log('🚀 MIGRAÇÃO DEFINITIVA - Unificando workflow_sessions → lunari_workflow_items');

    // Carregar dados de TODAS as fontes
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    console.log('📊 Estado inicial:', {
      workflowItems: workflowItems.length,
      clientes: clientes.length,
      workflowSessions: workflowSessions.length
    });

    // UNIFICAÇÃO DEFINITIVA: workflow_sessions → lunari_workflow_items
    const allWorkflowItems = new Map<string, WorkflowItem>();
    
    // 1. Adicionar workflowItems existentes (prioridade)
    workflowItems.forEach(item => {
      allWorkflowItems.set(item.id, item);
    });
    
    // 2. Consolidar workflow_sessions que não existem como workflowItems
    let sessoesConsolidadas = 0;
    workflowSessions.forEach((session: any) => {
      if (!allWorkflowItems.has(session.id)) {
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
          clienteId: session.clienteId // Preservar se já existir
        };
        
        allWorkflowItems.set(session.id, workflowItem);
        sessoesConsolidadas++;
      }
    });

    // 3. APLICAR clienteId usando APENAS nome exato (sem fallbacks)
    let itemsComClienteIdAtualizado = 0;
    const workflowItemsFinais = Array.from(allWorkflowItems.values()).map(item => {
      // Se já tem clienteId válido, manter
      if (item.clienteId && clientes.find(c => c.id === item.clienteId)) {
        return item;
      }

      // Buscar cliente por nome EXATO
      const clienteEncontrado = clientes.find(cliente => 
        cliente.nome.toLowerCase().trim() === item.nome.toLowerCase().trim()
      );

      if (clienteEncontrado) {
        itemsComClienteIdAtualizado++;
        return {
          ...item,
          clienteId: clienteEncontrado.id
        };
      }

      // Sem clienteId = item fica sem associação ao CRM
      return item;
    });

    // 4. SALVAR na fonte única: lunari_workflow_items
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItemsFinais);
    
    // 5. LIMPAR workflow_sessions definitivamente
    localStorage.removeItem('workflow_sessions');
    
    // 6. Marcar migração como concluída
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log('✅ MIGRAÇÃO DEFINITIVA CONCLUÍDA:', {
      workflowItemsFinais: workflowItemsFinais.length,
      sessoesConsolidadas,
      itemsComClienteId: workflowItemsFinais.filter(i => i.clienteId).length,
      itemsComClienteIdAtualizado,
      itemsSemClienteId: workflowItemsFinais.filter(i => !i.clienteId).length
    });

    return true;

  } catch (error) {
    console.error('❌ Erro durante migração definitiva:', error);
    return false;
  }
}