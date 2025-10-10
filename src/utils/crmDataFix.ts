import { storage, STORAGE_KEYS } from './localStorage';
import { Cliente } from '@/types/cliente';

/**
 * @deprecated Este arquivo está obsoleto e será removido em versões futuras
 * 
 * MIGRAÇÃO PARA SUPABASE:
 * - Use useClientMetrics (busca do Supabase) em vez de getSimplifiedClientMetrics (LocalStorage)
 * - Use useClientMetricsRealtime para métricas individuais de clientes
 * - Todos os dados agora são persistidos no Supabase com RLS policies
 * 
 * MANTIDO TEMPORARIAMENTE APENAS PARA COMPATIBILIDADE DURANTE A MIGRAÇÃO
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
  origem?: string;
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
 * Função robusta para parsing de valores financeiros (UNIFICADA)
 * Mesma lógica usada no WorkflowHistoryTable para garantir consistência
 */
function parseFinancialValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;

  // Se já é um número, retornar diretamente
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  // Se é string, limpar e converter
  if (typeof value === 'string') {
    // Remover R$, espaços, pontos de milhares e converter vírgula para ponto
    const cleaned = value.replace(/[^\d,.-]/g, '') // Remove tudo exceto dígitos, vírgula, ponto e hífen
      .replace(/\./g, '') // Remove pontos (milhares)
      .replace(/,/g, '.'); // Converte vírgula para ponto

    const parsed = parseFloat(cleaned);
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
      total: parseFinancialValue(item.total),
      valorPago: parseFinancialValue(item.valorPago),
      valorPacote: parseFinancialValue(item.valorPacote),
      valorTotalFotoExtra: parseFinancialValue(item.valorTotalFotoExtra),
      valorTotalProduto: parseFinancialValue(item.valorTotalProduto),
      valorAdicional: parseFinancialValue(item.valorAdicional),
      desconto: parseFinancialValue(item.desconto),
      restante: parseFinancialValue(item.total) - parseFinancialValue(item.valorPago)
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
 * SINCRONIZADA COM WorkflowHistoryTable para garantir totais idênticos
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
    }).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // DEDUPLICAÇÃO FINAL por sessionId (MESMA LÓGICA DO WorkflowHistoryTable)
    const sessionMap = new Map();
    clienteSessions.forEach((session: any) => {
      const sessionKey = session.sessionId || session.id;
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, session);
      }
    });

    // Converter Map de volta para array e RECALCULAR TOTAIS DINAMICAMENTE
    const sessionsCalculadas = Array.from(sessionMap.values()).map((session: any) => {
      const valorPacote = parseFinancialValue(session.valorPacote);
      const valorTotalFotoExtra = parseFinancialValue(session.valorTotalFotoExtra);
      const valorTotalProduto = parseFinancialValue(session.valorTotalProduto);
      const valorAdicional = parseFinancialValue(session.valorAdicional);
      const desconto = parseFinancialValue(session.desconto);
      
      // RECÁLCULO DINÂMICO (mesma fórmula do WorkflowHistoryTable)
      const totalCalculado = valorPacote + valorTotalFotoExtra + valorTotalProduto + valorAdicional - desconto;
      
      return {
        ...session,
        total: totalCalculado,
        valorPago: parseFinancialValue(session.valorPago)
      };
    });
    
    // Cálculos usando dados recalculados (garantia de precisão)
    const totalSessoes = sessionsCalculadas.length;
    const totalFaturado = sessionsCalculadas.reduce((acc: number, session: any) => 
      acc + session.total, 0
    );
    const totalPago = sessionsCalculadas.reduce((acc: number, session: any) => 
      acc + session.valorPago, 0
    );
    // Garantir que aReceber nunca seja negativo
    const aReceber = Math.max(0, totalFaturado - totalPago);
    
    // Última sessão (usando dados recalculados)
    let ultimaSessao: Date | null = null;
    if (sessionsCalculadas.length > 0) {
      const datasOrdenadas = sessionsCalculadas
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
      origem: cliente.origem,
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