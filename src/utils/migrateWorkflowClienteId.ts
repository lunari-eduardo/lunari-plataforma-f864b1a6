import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Cliente } from '@/types/cliente';

/**
 * Migração para adicionar clienteId aos workflowItems existentes
 * Executa apenas uma vez para workflowItems que não têm clienteId
 */
export function migrateWorkflowClienteId() {
  try {
    const MIGRATION_KEY = 'workflow_clienteId_migrated';
    
    // Verificar se migração já foi executada
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      // Migração já executada, retornando silenciosamente
      return;
    }

    // Migração executando silenciosamente

    // Carregar dados necessários
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    
    // Dados carregados silenciosamente

    let itemsAtualizados = 0;
    
    // Migrar workflowItems
    const workflowItemsAtualizados = workflowItems.map(item => {
      // Se já tem clienteId, manter como está
      if (item.clienteId) {
        return item;
      }

      // Buscar cliente por nome (normalizado)
      const clienteEncontrado = clientes.find(cliente => 
        cliente.nome.toLowerCase().trim() === item.nome.toLowerCase().trim()
      );

      if (clienteEncontrado) {
        itemsAtualizados++;
        return {
          ...item,
          clienteId: clienteEncontrado.id
        };
      }

      // Se não encontrou cliente, manter sem clienteId mas logar
      console.warn(`⚠️ Cliente não encontrado para workflowItem: ${item.nome} (ID: ${item.id})`);
      return item;
    });

    // Salvar workflowItems atualizados
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItemsAtualizados);

    // Migrar workflow_sessions também (se existir)
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    if (workflowSessions.length > 0) {
      const sessionsAtualizadas = workflowSessions.map((session: any) => {
        if (session.clienteId) {
          return session;
        }

        const clienteEncontrado = clientes.find(cliente => 
          cliente.nome.toLowerCase().trim() === session.nome?.toLowerCase().trim()
        );

        if (clienteEncontrado) {
          return {
            ...session,
            clienteId: clienteEncontrado.id
          };
        }

        return session;
      });

      localStorage.setItem('workflow_sessions', JSON.stringify(sessionsAtualizadas));
    }

    // Marcar migração como concluída
    localStorage.setItem(MIGRATION_KEY, 'true');

    // Migração concluída silenciosamente

  } catch (error) {
    console.error('❌ Erro durante migração de clienteId:', error);
  }
}