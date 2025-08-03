import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';

/**
 * 🚀 MIGRAÇÃO MELHORADA: Associar clienteId aos workflowItems existentes
 * 
 * MELHORIAS:
 * - Execução mais robusta e à prova de falhas
 * - Criação automática de clientes se necessário
 * - Validação completa de integridade
 * - Relatório detalhado de resultados
 */
export function migrateWorkflowClienteId() {
  try {
    const MIGRATION_KEY = 'workflow_clienteId_migrated_v2'; // Nova versão
    
    // Verificar se migração já foi executada
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      console.log('🔄 Migração de clienteId v2 já executada anteriormente');
      return;
    }

    console.log('🚀 INICIANDO MIGRAÇÃO MELHORADA de clienteId para workflowItems...');

    // Carregar dados necessários
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    
    console.log('📊 DADOS PARA MIGRAÇÃO:', {
      workflowItems: workflowItems.length,
      clientes: clientes.length,
      itemsSemClienteId: workflowItems.filter(item => !item.clienteId).length
    });

    let itemsAtualizados = 0;
    let clientesCriados = 0;
    let novosClientes = [...clientes];
    
    // MIGRAÇÃO MELHORADA: workflowItems
    const workflowItemsAtualizados = workflowItems.map(item => {
      // Se já tem clienteId válido, manter como está
      if (item.clienteId) {
        const clienteExiste = novosClientes.find(c => c.id === item.clienteId);
        if (clienteExiste) {
          return item;
        }
        console.warn(`⚠️ clienteId ${item.clienteId} não existe mais, removendo...`);
      }

      // Buscar cliente por nome (normalizado e flexível)
      let clienteEncontrado = novosClientes.find(cliente => {
        const nomeCliente = cliente.nome.toLowerCase().trim();
        const nomeItem = item.nome.toLowerCase().trim();
        
        // Correspondência exata
        if (nomeCliente === nomeItem) return true;
        
        // Correspondência parcial (para casos como "João" vs "João Silva")
        if (nomeCliente.includes(nomeItem) || nomeItem.includes(nomeCliente)) {
          return true;
        }
        
        return false;
      });

      // Se não encontrou cliente, CRIAR AUTOMATICAMENTE
      if (!clienteEncontrado) {
        console.log(`🆕 CRIANDO cliente para workflowItem: ${item.nome}`);
        
        clienteEncontrado = {
          id: crypto.randomUUID(),
          nome: item.nome,
          email: item.email || '',
          telefone: item.whatsapp || '',
          endereco: '',
          observacoes: `Cliente migrado automaticamente em ${new Date().toLocaleDateString()}`
        };
        
        novosClientes.push(clienteEncontrado);
        clientesCriados++;
      }

      itemsAtualizados++;
      return {
        ...item,
        clienteId: clienteEncontrado.id
      };
    });

    // Salvar dados atualizados
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItemsAtualizados);
    
    // Salvar novos clientes criados
    if (clientesCriados > 0) {
      storage.save(STORAGE_KEYS.CLIENTS, novosClientes);
      console.log('✅ NOVOS CLIENTES SALVOS:', clientesCriados);
    }

    // MIGRAÇÃO workflow_sessions (compatibilidade)
    let sessionsAtualizadas = 0;
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    if (workflowSessions.length > 0) {
      const sessionsProcessadas = workflowSessions.map((session: any) => {
        if (session.clienteId) {
          return session;
        }

        const clienteEncontrado = novosClientes.find(cliente => 
          cliente.nome.toLowerCase().trim() === session.nome?.toLowerCase().trim()
        );

        if (clienteEncontrado) {
          sessionsAtualizadas++;
          return {
            ...session,
            clienteId: clienteEncontrado.id
          };
        }

        return session;
      });

      localStorage.setItem('workflow_sessions', JSON.stringify(sessionsProcessadas));
    }

    // VALIDAÇÃO FINAL: verificar se todos os itens têm clienteId
    const itensSemClienteId = workflowItemsAtualizados.filter(item => !item.clienteId);
    
    if (itensSemClienteId.length > 0) {
      console.error('❌ MIGRAÇÃO INCOMPLETA! Itens sem clienteId:', itensSemClienteId.map(i => ({
        id: i.id,
        nome: i.nome
      })));
    }

    // Marcar migração como concluída
    localStorage.setItem(MIGRATION_KEY, 'true');

    const relatorioFinal = {
      workflowItemsProcessados: workflowItems.length,
      workflowItemsAtualizados: itemsAtualizados,
      clientesCriados,
      workflowSessionsAtualizadas: sessionsAtualizadas,
      itensSemClienteId: itensSemClienteId.length,
      sucesso: itensSemClienteId.length === 0
    };

    console.log('🎊 MIGRAÇÃO CONCLUÍDA - RELATÓRIO FINAL:', relatorioFinal);

    return relatorioFinal;

  } catch (error) {
    console.error('❌ Erro durante migração de clienteId:', error);
  }
}