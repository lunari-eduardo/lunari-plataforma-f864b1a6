import { storage, STORAGE_KEYS } from './localStorage';
import { Cliente } from '@/types/orcamentos';

/**
 * SOLUÇÃO DEFINITIVA SIMPLIFICADA DO CRM
 * 
 * Sistema único e simples que corrige TODAS as inconsistências:
 * 1. Use APENAS workflow_sessions como fonte única de verdade
 * 2. Elimine valores NaN completamente
 * 3. Corrija clienteId órfãos automaticamente
 * 4. Simplifique cálculos para garantir precisão
 */

export interface SimplifiedMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: Date | null;
}

/**
 * Função para normalizar nome (busca inteligente)
 */
function normalizeClientName(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Função para converter valor monetário com segurança
 */
function parseMonetaryValue(value: any): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Função para buscar cliente por nome
 */
function findClientByName(nome: string, clientes: Cliente[]): Cliente | null {
  if (!nome) return null;
  
  const normalizedSearchName = normalizeClientName(nome);
  
  // Busca exata
  let found = clientes.find(cliente => 
    normalizeClientName(cliente.nome) === normalizedSearchName
  );
  
  if (found) return found;
  
  // Busca parcial
  found = clientes.find(cliente => {
    const clienteNormalized = normalizeClientName(cliente.nome);
    return clienteNormalized.includes(normalizedSearchName) ||
           normalizedSearchName.includes(clienteNormalized);
  });
  
  return found || null;
}

/**
 * FUNÇÃO PRINCIPAL: Correção completa e simplificada + DEDUPLICAÇÃO
 */
export function fixCrmDataDefinitive(): boolean {
  console.log('🚀 === CORREÇÃO DEFINITIVA DOS DADOS CRM + DEDUPLICAÇÃO ===');
  
  try {
    // 1. Carregar dados
    let clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    let workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    console.log('📊 Dados antes da correção:', {
      clientes: clientes.length,
      workflowSessions: workflowSessions.length
    });
    
    // 2. DEDUPLICAÇÃO POR sessionId (PRIORIDADE ALTA)
    const sessionMap = new Map();
    let duplicatesRemoved = 0;
    
    workflowSessions.forEach((item: any) => {
      const sessionKey = item.sessionId || item.id;
      
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, item);
      } else {
        // Conflito: escolher o mais recente ou mais completo
        const existing = sessionMap.get(sessionKey);
        const currentTime = new Date(item.dataOriginal || item.data || '2024-01-01').getTime();
        const existingTime = new Date(existing.dataOriginal || existing.data || '2024-01-01').getTime();
        
        // Priorizar: dados mais recentes E com clienteId definido
        const shouldReplace = currentTime > existingTime || 
                             (item.clienteId && !existing.clienteId) ||
                             (item.total > 0 && existing.total === 0);
        
        if (shouldReplace) {
          console.log(`🔄 Substituindo duplicata: ${sessionKey} - ${existing.nome} → ${item.nome}`);
          sessionMap.set(sessionKey, item);
        } else {
          console.log(`🗑️ Removendo duplicata: ${sessionKey} - ${item.nome}`);
        }
        duplicatesRemoved++;
      }
    });
    
    // Converter Map de volta para array
    workflowSessions = Array.from(sessionMap.values());
    
    console.log(`✅ Deduplicação concluída: ${duplicatesRemoved} duplicatas removidas`);
    
    // 3. CORRIGIR TODOS OS VALORES NaN
    workflowSessions = workflowSessions.map((item: any) => ({
      ...item,
      total: parseMonetaryValue(item.total),
      valorPago: parseMonetaryValue(item.valorPago),
      valorPacote: parseMonetaryValue(item.valorPacote),
      valorTotalFotoExtra: parseMonetaryValue(item.valorTotalFotoExtra),
      valorTotalProduto: parseMonetaryValue(item.valorTotalProduto),
      valorAdicional: parseMonetaryValue(item.valorAdicional),
      desconto: parseMonetaryValue(item.desconto),
      restante: parseMonetaryValue(item.total) - parseMonetaryValue(item.valorPago)
    }));
    
    // 4. CORRIGIR CLIENTEID ÓRFÃOS
    let clientsCreated = 0;
    
    workflowSessions = workflowSessions.map((item: any) => {
      // Se não tem clienteId mas tem nome, tentar encontrar cliente
      if (!item.clienteId && item.nome) {
        const clienteEncontrado = findClientByName(item.nome, clientes);
        
        if (clienteEncontrado) {
          console.log(`🎯 ClienteId restaurado: ${item.nome} → ${clienteEncontrado.id}`);
          return { ...item, clienteId: clienteEncontrado.id };
        } else {
          // Criar cliente automaticamente
          const novoCliente: Cliente = {
            id: `cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            nome: item.nome,
            telefone: item.whatsapp || '+55 (11) 99999-9999',
            email: item.email || `${normalizeClientName(item.nome).replace(/\s/g, '')}@email.com`,
            endereco: ''
          };
          
          clientes.push(novoCliente);
          clientsCreated++;
          
          console.log(`👤 Cliente criado: ${novoCliente.nome} (${novoCliente.id})`);
          return { ...item, clienteId: novoCliente.id };
        }
      }
      
      return item;
    });
    
    // 5. RECALCULAR TOTAIS (garantir consistência)
    workflowSessions = workflowSessions.map((item: any) => {
      const valorBase = item.valorPacote || 0;
      const fotosExtra = item.valorTotalFotoExtra || 0;
      const produtos = item.valorTotalProduto || 0;
      const adicional = item.valorAdicional || 0;
      const desconto = item.desconto || 0;
      
      const totalCalculado = valorBase + fotosExtra + produtos + adicional - desconto;
      const valorPago = item.valorPago || 0;
      const restante = totalCalculado - valorPago;
      
      return {
        ...item,
        total: totalCalculado,
        valorPago: valorPago,
        restante: restante
      };
    });
    
    // 6. SALVAR DADOS CORRIGIDOS
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
    localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessions));
    
    // 7. LIMPAR DADOS ANTIGOS PARA EVITAR CONFLITOS
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    
    // 8. MARCAR CORREÇÃO COMO CONCLUÍDA
    localStorage.setItem('crm_fix_completed', new Date().toISOString());
    
    console.log('✅ CORREÇÃO COMPLETA CONCLUÍDA:', {
      duplicatesRemoved,
      clientsCreated,
      totalWorkflowSessions: workflowSessions.length,
      workflowsWithClientId: workflowSessions.filter((s: any) => s.clienteId).length
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro na correção definitiva:', error);
    return false;
  }
}

/**
 * Função para calcular métricas simplificadas e precisas
 */
export function getSimplifiedClientMetrics(clientes: Cliente[]): SimplifiedMetrics[] {
  const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
  
  return clientes.map(cliente => {
    // Buscar sessões do cliente (por clienteId E por nome como fallback)
    const clienteSessions = workflowSessions.filter((session: any) => {
      const matchByClienteId = session.clienteId === cliente.id;
      const matchByName = !session.clienteId && 
        session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });
    
    // Cálculos simples e diretos
    const totalSessoes = clienteSessions.length;
    const totalFaturado = clienteSessions.reduce((acc: number, session: any) => 
      acc + parseMonetaryValue(session.total), 0
    );
    const totalPago = clienteSessions.reduce((acc: number, session: any) => 
      acc + parseMonetaryValue(session.valorPago), 0
    );
    const aReceber = totalFaturado - totalPago;
    
    // Última sessão
    let ultimaSessao: Date | null = null;
    if (clienteSessions.length > 0) {
      const datasOrdenadas = clienteSessions
        .map((session: any) => new Date(session.data))
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
      totalSessoes,
      totalFaturado,
      totalPago,
      aReceber,
      ultimaSessao
    };
  });
}

/**
 * Função para executar correção automaticamente se necessário
 */
export function autoFixIfNeeded(): void {
  const lastFix = localStorage.getItem('crm_fix_completed');
  const now = new Date().getTime();
  const oneHour = 60 * 60 * 1000;
  
  // Executar se nunca foi executada ou se passou mais de 1 hora
  if (!lastFix || (now - new Date(lastFix).getTime()) > oneHour) {
    console.log('🔧 Executando correção automática do CRM...');
    fixCrmDataDefinitive();
  }
}