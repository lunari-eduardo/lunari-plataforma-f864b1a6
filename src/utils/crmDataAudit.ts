import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';

/**
 * FASE 1: AUDITORIA COMPLETA DOS DADOS DO CRM
 * 
 * Sistema completo de auditoria e debug para identificar todos os problemas
 * de integração entre clientes, workflow e dados financeiros
 */

export interface DataAuditReport {
  timestamp: string;
  summary: {
    totalClientes: number;
    totalWorkflowItems: number;
    totalWorkflowSessions: number;
    clientesComWorkflow: number;
    clientesSemWorkflow: number;
    workflowsOrfaos: number;
    totalFaturado: number;
    totalPago: number;
    totalAReceber: number;
  };
  problems: {
    clienteIdMissing: WorkflowItem[];
    clienteIdCorrupted: WorkflowItem[];
    valorNaN: WorkflowItem[];
    duplicateData: { workflowId: string; sources: string[] }[];
    inconsistentCalculations: { workflowId: string; expected: number; actual: number }[];
  };
  clientAnalysis: {
    clienteId: string;
    nome: string;
    workflowCount: number;
    sessionCount: number;
    totalFaturado: number;
    totalPago: number;
    aReceber: number;
    hasProblems: boolean;
    problems: string[];
  }[];
}

/**
 * Função principal de auditoria completa
 */
export function performFullDataAudit(): DataAuditReport {
  console.log('🔍 === INICIANDO AUDITORIA COMPLETA DOS DADOS CRM ===');
  
  const timestamp = new Date().toISOString();
  
  // Carregar todos os dados
  const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
  const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
  const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
  
  console.log('📊 Dados carregados:', {
    clientes: clientes.length,
    workflowItems: workflowItems.length,
    workflowSessions: workflowSessions.length
  });

  // Análise dos problemas
  const problems = {
    clienteIdMissing: [] as WorkflowItem[],
    clienteIdCorrupted: [] as WorkflowItem[],
    valorNaN: [] as WorkflowItem[],
    duplicateData: [] as { workflowId: string; sources: string[] }[],
    inconsistentCalculations: [] as { workflowId: string; expected: number; actual: number }[]
  };

  // 1. ANALISAR WORKFLOW ITEMS
  workflowItems.forEach(item => {
    // Verificar clienteId missing
    if (!item.clienteId) {
      problems.clienteIdMissing.push(item);
    }
    
    // Verificar clienteId corrompido
    if (item.clienteId && typeof item.clienteId === 'object') {
      problems.clienteIdCorrupted.push(item);
    }
    
    // Verificar valores NaN
    if (isNaN(item.total) || isNaN(item.valorPago) || isNaN(item.valorPacote)) {
      problems.valorNaN.push(item);
    }
    
    // Verificar cálculos inconsistentes
    const expectedTotal = (item.valorPacote || 0) + 
                         (item.valorTotalFotoExtra || 0) + 
                         (item.valorTotalProduto || 0) + 
                         (item.valorAdicional || 0) - 
                         (item.desconto || 0);
    
    if (Math.abs(item.total - expectedTotal) > 0.01) {
      problems.inconsistentCalculations.push({
        workflowId: item.id,
        expected: expectedTotal,
        actual: item.total
      });
    }
  });

  // 2. ANALISAR DUPLICAÇÕES
  const workflowIds = new Set();
  const sources = ['workflowItems', 'workflowSessions'];
  
  [...workflowItems, ...workflowSessions].forEach(item => {
    if (workflowIds.has(item.id)) {
      problems.duplicateData.push({
        workflowId: item.id,
        sources: sources
      });
    }
    workflowIds.add(item.id);
  });

  // 3. ANÁLISE POR CLIENTE
  const clientAnalysis = clientes.map(cliente => {
    // Buscar workflows do cliente por clienteId E por nome (fallback)
    const workflowsByClienteId = workflowItems.filter(item => item.clienteId === cliente.id);
    const workflowsByName = workflowItems.filter(item => 
      !item.clienteId && item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim()
    );
    const sessionsByClienteId = workflowSessions.filter((item: any) => item.clienteId === cliente.id);
    
    const allWorkflows = [...workflowsByClienteId, ...workflowsByName];
    
    // Cálculos financeiros
    const totalFaturado = allWorkflows.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalPago = allWorkflows.reduce((acc, item) => acc + (item.valorPago || 0), 0);
    const aReceber = totalFaturado - totalPago;
    
    // Identificar problemas do cliente
    const clientProblems: string[] = [];
    
    if (workflowsByName.length > 0) {
      clientProblems.push(`${workflowsByName.length} workflows sem clienteId`);
    }
    
    if (allWorkflows.some(w => isNaN(w.total) || isNaN(w.valorPago))) {
      clientProblems.push('Valores NaN detectados');
    }
    
    if (isNaN(aReceber)) {
      clientProblems.push('Cálculo A Receber inválido');
    }
    
    return {
      clienteId: cliente.id,
      nome: cliente.nome,
      workflowCount: allWorkflows.length,
      sessionCount: sessionsByClienteId.length,
      totalFaturado,
      totalPago,
      aReceber,
      hasProblems: clientProblems.length > 0,
      problems: clientProblems
    };
  });

  // 4. SUMMARY GERAL
  const summary = {
    totalClientes: clientes.length,
    totalWorkflowItems: workflowItems.length,
    totalWorkflowSessions: workflowSessions.length,
    clientesComWorkflow: clientAnalysis.filter(c => c.workflowCount > 0).length,
    clientesSemWorkflow: clientAnalysis.filter(c => c.workflowCount === 0).length,
    workflowsOrfaos: problems.clienteIdMissing.length,
    totalFaturado: clientAnalysis.reduce((acc, c) => acc + c.totalFaturado, 0),
    totalPago: clientAnalysis.reduce((acc, c) => acc + c.totalPago, 0),
    totalAReceber: clientAnalysis.reduce((acc, c) => acc + c.aReceber, 0)
  };

  const report: DataAuditReport = {
    timestamp,
    summary,
    problems,
    clientAnalysis
  };

  // LOG COMPLETO DOS RESULTADOS
  console.log('📊 RELATÓRIO DE AUDITORIA COMPLETO:', report);
  
  // Salvar relatório para debug
  localStorage.setItem('crm_audit_report', JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * Função para mostrar resumo dos problemas encontrados
 */
export function showAuditSummary(): void {
  const report = performFullDataAudit();
  
  console.log('🎯 === RESUMO DOS PROBLEMAS ENCONTRADOS ===');
  console.log('🔍 Workflows sem clienteId:', report.problems.clienteIdMissing.length);
  console.log('💥 ClienteIds corrompidos:', report.problems.clienteIdCorrupted.length);
  console.log('❌ Valores NaN:', report.problems.valorNaN.length);
  console.log('📊 Cálculos inconsistentes:', report.problems.inconsistentCalculations.length);
  console.log('👥 Clientes com problemas:', report.clientAnalysis.filter(c => c.hasProblems).length);
  
  if (report.problems.clienteIdMissing.length > 0) {
    console.log('🔍 Amostra de workflows órfãos:');
    report.problems.clienteIdMissing.slice(0, 3).forEach(item => {
      console.log(`  - ${item.nome} (${item.id}) - Total: R$ ${item.total}`);
    });
  }
  
  if (report.clientAnalysis.filter(c => c.hasProblems).length > 0) {
    console.log('👥 Clientes com problemas:');
    report.clientAnalysis
      .filter(c => c.hasProblems)
      .slice(0, 5)
      .forEach(cliente => {
        console.log(`  - ${cliente.nome}: ${cliente.problems.join(', ')}`);
      });
  }
}

/**
 * Função para normalizar nome (para matching)
 */
export function normalizeClientName(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Função para encontrar cliente por nome com busca inteligente
 */
export function findClientByName(nome: string, clientes: Cliente[]): Cliente | null {
  if (!nome) return null;
  
  const normalizedSearchName = normalizeClientName(nome);
  
  // Busca exata
  let found = clientes.find(cliente => 
    normalizeClientName(cliente.nome) === normalizedSearchName
  );
  
  if (found) return found;
  
  // Busca parcial (contém)
  found = clientes.find(cliente => 
    normalizeClientName(cliente.nome).includes(normalizedSearchName) ||
    normalizedSearchName.includes(normalizeClientName(cliente.nome))
  );
  
  if (found) return found;
  
  // Busca por palavras-chave
  const searchWords = normalizedSearchName.split(' ').filter(w => w.length > 2);
  if (searchWords.length > 0) {
    found = clientes.find(cliente => {
      const clienteWords = normalizeClientName(cliente.nome).split(' ');
      return searchWords.some(searchWord => 
        clienteWords.some(clienteWord => 
          clienteWord.includes(searchWord) || searchWord.includes(clienteWord)
        )
      );
    });
  }
  
  return found || null;
}