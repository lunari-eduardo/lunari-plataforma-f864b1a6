import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';

/**
 * MIGRAÇÃO INVERTIDA: Consolidar todos os dados para workflow_sessions
 * Migra dados de lunari_workflow_items para workflow_sessions e elimina duplicação
 */
export function migrateToWorkflowSessions() {
  try {
    const MIGRATION_KEY = 'inverted_migration_completed';
    
    // Verificar se migração já foi executada
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      console.log('🔄 Migração invertida já executada anteriormente');
      return;
    }

    console.log('🚀 Iniciando migração invertida para workflow_sessions...');

    // Carregar dados de ambas as fontes
    const lunariWorkflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const currentWorkflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    console.log('📊 Dados para migração invertida:', {
      lunariWorkflowItems: lunariWorkflowItems.length,
      currentWorkflowSessions: currentWorkflowSessions.length
    });

    // Criar backup antes da migração
    if (lunariWorkflowItems.length > 0 || currentWorkflowSessions.length > 0) {
      localStorage.setItem('backup_before_inverted_migration', JSON.stringify({
        lunariWorkflowItems,
        currentWorkflowSessions,
        timestamp: new Date().toISOString()
      }));
      console.log('💾 Backup criado antes da migração');
    }

    // Consolidar dados: workflow_sessions como base + lunari_workflow_items
    const consolidatedItems = new Map<string, any>();

    // 1. Primeiro, adicionar todos os workflow_sessions existentes
    currentWorkflowSessions.forEach((session: any) => {
      consolidatedItems.set(session.id, {
        ...session,
        // Garantir campos obrigatórios
        pagamentos: session.pagamentos || [],
        produtosList: session.produtosList || [],
        fonte: session.fonte || 'agenda'
      });
    });

    // 2. Depois, sobrescrever/adicionar dados de lunari_workflow_items (dados mais recentes)
    let itemsMigrados = 0;
    lunariWorkflowItems.forEach(item => {
      // Converter WorkflowItem para formato workflow_sessions
      const sessionData = {
        id: item.id,
        data: item.data,
        hora: item.hora || '',
        nome: item.nome || '',
        whatsapp: item.whatsapp || '',
        email: item.email || '',
        descricao: item.descricao || '',
        status: item.status || '',
        categoria: item.categoria || '',
        pacote: item.pacote || '',
        valorPacote: item.valorPacote ? `R$ ${item.valorPacote.toFixed(2).replace('.', ',')}` : '',
        desconto: item.desconto || 0,
        valorFotoExtra: item.valorFotoExtra ? `R$ ${item.valorFotoExtra.toFixed(2).replace('.', ',')}` : '',
        qtdFotosExtra: item.qtdFotoExtra || 0,
        valorTotalFotoExtra: item.valorTotalFotoExtra ? `R$ ${item.valorTotalFotoExtra.toFixed(2).replace('.', ',')}` : '',
        produto: item.produto || '',
        qtdProduto: item.qtdProduto || 0,
        valorTotalProduto: item.valorTotalProduto ? `R$ ${item.valorTotalProduto.toFixed(2).replace('.', ',')}` : '',
        produtosList: item.produtosList || [],
        valorAdicional: item.valorAdicional ? `R$ ${item.valorAdicional.toFixed(2).replace('.', ',')}` : '',
        detalhes: item.detalhes || '',
        valor: item.total ? `R$ ${item.total.toFixed(2).replace('.', ',')}` : '',
        total: item.total ? `R$ ${item.total.toFixed(2).replace('.', ',')}` : '',
        valorPago: item.valorPago ? `R$ ${item.valorPago.toFixed(2).replace('.', ',')}` : '',
        restante: item.restante ? `R$ ${item.restante.toFixed(2).replace('.', ',')}` : '',
        pagamentos: item.pagamentos || [],
        fonte: item.fonte || 'agenda',
        dataOriginal: item.dataOriginal,
        // Campos específicos do workflow
        valorFinalAjustado: item.valorFinalAjustado,
        valorOriginalOrcamento: item.valorOriginalOrcamento,
        percentualAjusteOrcamento: item.percentualAjusteOrcamento,
        regrasDePrecoFotoExtraCongeladas: item.regrasDePrecoFotoExtraCongeladas,
        clienteId: item.clienteId
      };

      consolidatedItems.set(item.id, sessionData);
      itemsMigrados++;
    });

    // Salvar dados consolidados
    const finalWorkflowSessions = Array.from(consolidatedItems.values());
    localStorage.setItem('workflow_sessions', JSON.stringify(finalWorkflowSessions));

    // Marcar migração como concluída
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log('✅ Migração invertida concluída:', {
      totalItens: finalWorkflowSessions.length,
      itemsMigrados,
      sessionsExistentes: currentWorkflowSessions.length
    });

    // Opcional: Manter lunari_workflow_items como backup temporário
    // Não remover até confirmar que tudo funciona

  } catch (error) {
    console.error('❌ Erro durante migração invertida:', error);
  }
}

/**
 * Função para rollback em caso de problemas
 */
export function rollbackInvertedMigration() {
  try {
    const backup = localStorage.getItem('backup_before_inverted_migration');
    if (backup) {
      const { lunariWorkflowItems, currentWorkflowSessions } = JSON.parse(backup);
      
      // Restaurar dados originais
      storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, lunariWorkflowItems);
      localStorage.setItem('workflow_sessions', JSON.stringify(currentWorkflowSessions));
      
      // Remover flag de migração
      localStorage.removeItem('inverted_migration_completed');
      
      console.log('🔄 Rollback da migração invertida executado com sucesso');
    } else {
      console.warn('⚠️ Nenhum backup encontrado para rollback');
    }
  } catch (error) {
    console.error('❌ Erro durante rollback:', error);
  }
}