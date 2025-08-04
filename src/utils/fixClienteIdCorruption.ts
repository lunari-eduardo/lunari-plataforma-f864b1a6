import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';

/**
 * Utilitário para corrigir problemas de corrupção de clienteId no sistema
 * Corrige valores como {"_type": "undefined", "value": "undefined"}
 */

// Tipo para representar clienteId corrompido
interface CorruptedClienteId {
  _type: string;
  value: any;
}

// Função para detectar clienteId corrompido
const isCorruptedClienteId = (clienteId: any): clienteId is CorruptedClienteId => {
  return (
    clienteId &&
    typeof clienteId === 'object' &&
    clienteId._type === 'undefined' &&
    clienteId.value === 'undefined'
  );
};

// Função para limpar clienteId corrompido
const cleanClienteId = (clienteId: any): string | undefined => {
  if (!clienteId) return undefined;
  
  // Se for string normal, retornar como está
  if (typeof clienteId === 'string') return clienteId;
  
  // Se for objeto corrompido, retornar undefined
  if (isCorruptedClienteId(clienteId)) {
    console.warn('🔧 ClienteId corrompido detectado e removido:', clienteId);
    return undefined;
  }
  
  // Para outros tipos, tentar converter para string ou retornar undefined
  if (typeof clienteId === 'number') return clienteId.toString();
  
  console.warn('🔧 ClienteId inválido detectado:', clienteId);
  return undefined;
};

// Função para normalizar nome (para matching por nome)
const normalizeNome = (nome: string): string => {
  return nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Função para encontrar cliente por nome
const findClienteByName = (nome: string, clientes: Cliente[]): Cliente | undefined => {
  const normalizedName = normalizeNome(nome);
  
  return clientes.find(cliente => {
    const clienteNormalizado = normalizeNome(cliente.nome);
    return clienteNormalizado === normalizedName;
  });
};

/**
 * Função principal para corrigir todas as corrupções de clienteId
 */
export function fixClienteIdCorruption(): { 
  workflowItemsFixed: number; 
  sessionsFixed: number; 
  unifiedDataFixed: number; 
} {
  console.log('🚀 Iniciando correção de corrupções de clienteId...');
  
  let workflowItemsFixed = 0;
  let sessionsFixed = 0;
  let unifiedDataFixed = 0;
  
  try {
    // Carregar dados
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    
    console.log('📊 Dados carregados:', {
      clientes: clientes.length,
      workflowItems: workflowItems.length
    });
    
    // 1. CORRIGIR WORKFLOW ITEMS
    const workflowItemsCorrigidos = workflowItems.map(item => {
      const clienteIdOriginal = item.clienteId;
      const clienteIdLimpo = cleanClienteId(clienteIdOriginal);
      
      // Se foi corrigido (removido corrupção)
      if (clienteIdOriginal !== clienteIdLimpo) {
        workflowItemsFixed++;
        console.log(`🔧 WorkflowItem corrigido: ${item.nome} - clienteId: ${JSON.stringify(clienteIdOriginal)} → ${clienteIdLimpo || 'undefined'}`);
      }
      
      // Se não tem clienteId válido, tentar encontrar por nome
      if (!clienteIdLimpo && item.nome) {
        const clienteEncontrado = findClienteByName(item.nome, clientes);
        if (clienteEncontrado) {
          console.log(`🎯 ClienteId restaurado por nome: ${item.nome} → ${clienteEncontrado.id}`);
          return { ...item, clienteId: clienteEncontrado.id };
        }
      }
      
      return { ...item, clienteId: clienteIdLimpo };
    });
    
    // 2. CORRIGIR WORKFLOW SESSIONS
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const sessionsCorrigidas = workflowSessions.map((session: any) => {
      const clienteIdOriginal = session.clienteId;
      const clienteIdLimpo = cleanClienteId(clienteIdOriginal);
      
      // Se foi corrigido (removido corrupção)
      if (clienteIdOriginal !== clienteIdLimpo) {
        sessionsFixed++;
        console.log(`🔧 Session corrigida: ${session.nome} - clienteId: ${JSON.stringify(clienteIdOriginal)} → ${clienteIdLimpo || 'undefined'}`);
      }
      
      // Se não tem clienteId válido, tentar encontrar por nome
      if (!clienteIdLimpo && session.nome) {
        const clienteEncontrado = findClienteByName(session.nome, clientes);
        if (clienteEncontrado) {
          console.log(`🎯 Session clienteId restaurado por nome: ${session.nome} → ${clienteEncontrado.id}`);
          return { ...session, clienteId: clienteEncontrado.id };
        }
      }
      
      return { ...session, clienteId: clienteIdLimpo };
    });
    
    // 3. CORRIGIR DADOS UNIFICADOS (se existir cache)
    const unifiedCacheKey = 'unified_workflow_cache';
    const unifiedCache = localStorage.getItem(unifiedCacheKey);
    if (unifiedCache) {
      try {
        const unifiedData = JSON.parse(unifiedCache);
        if (Array.isArray(unifiedData)) {
          const unifiedCorrigidos = unifiedData.map((item: any) => {
            const clienteIdOriginal = item.clienteId;
            const clienteIdLimpo = cleanClienteId(clienteIdOriginal);
            
            if (clienteIdOriginal !== clienteIdLimpo) {
              unifiedDataFixed++;
            }
            
            // Tentar restaurar por nome se necessário
            if (!clienteIdLimpo && item.nome) {
              const clienteEncontrado = findClienteByName(item.nome, clientes);
              if (clienteEncontrado) {
                return { ...item, clienteId: clienteEncontrado.id };
              }
            }
            
            return { ...item, clienteId: clienteIdLimpo };
          });
          
          localStorage.setItem(unifiedCacheKey, JSON.stringify(unifiedCorrigidos));
        }
      } catch (error) {
        console.warn('⚠️ Erro ao corrigir cache unificado:', error);
        localStorage.removeItem(unifiedCacheKey);
      }
    }
    
    // 4. SALVAR DADOS CORRIGIDOS
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItemsCorrigidos);
    localStorage.setItem('workflow_sessions', JSON.stringify(sessionsCorrigidas));
    
    // 5. MARCAR CORREÇÃO COMO EXECUTADA
    localStorage.setItem('clienteId_corruption_fixed', new Date().toISOString());
    
    console.log('✅ Correção de clienteId concluída:', {
      workflowItemsFixed,
      sessionsFixed,
      unifiedDataFixed
    });
    
    return { workflowItemsFixed, sessionsFixed, unifiedDataFixed };
    
  } catch (error) {
    console.error('❌ Erro durante correção de clienteId:', error);
    return { workflowItemsFixed: 0, sessionsFixed: 0, unifiedDataFixed: 0 };
  }
}

/**
 * Função para verificar se ainda há corrupções no sistema
 */
export function detectClienteIdCorruptions(): {
  workflowItemsCorrupted: number;
  sessionsCorrupted: number;
  details: any[];
} {
  const corruptions: any[] = [];
  let workflowItemsCorrupted = 0;
  let sessionsCorrupted = 0;
  
  // Verificar workflowItems
  const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
  workflowItems.forEach(item => {
    if (isCorruptedClienteId(item.clienteId)) {
      workflowItemsCorrupted++;
      corruptions.push({
        tipo: 'workflowItem',
        id: item.id,
        nome: item.nome,
        clienteIdCorrente: item.clienteId
      });
    }
  });
  
  // Verificar sessions
  const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
  workflowSessions.forEach((session: any) => {
    if (isCorruptedClienteId(session.clienteId)) {
      sessionsCorrupted++;
      corruptions.push({
        tipo: 'session',
        id: session.id,
        nome: session.nome,
        clienteIdCorrente: session.clienteId
      });
    }
  });
  
  return {
    workflowItemsCorrupted,
    sessionsCorrupted,
    details: corruptions
  };
}