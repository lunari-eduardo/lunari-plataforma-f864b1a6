import { storage, STORAGE_KEYS } from './localStorage';
import { WorkflowItem, ProdutoWorkflow } from '@/contexts/AppContext';
import { Cliente } from '@/types/cliente';
import { performFullDataAudit, findClientByName, normalizeClientName } from './crmDataAudit';

/**
 * FASE 2 & 3: CORREÇÃO COMPLETA DOS DADOS DO CRM
 * 
 * Sistema completo de correção automática para:
 * - Associar clienteIds corretos
 * - Unificar fontes de dados
 * - Corrigir cálculos financeiros
 * - Eliminar duplicações
 */

export interface CorrectionResult {
  timestamp: string;
  corrections: {
    clienteIdFixed: number;
    clienteIdRestored: number;
    clientsCreated: number;
    calculationsFixed: number;
    duplicatesRemoved: number;
    nanValuesFixed: number;
  };
  errors: string[];
  success: boolean;
}

/**
 * Função principal de correção completa
 */
export function performCompleteDataCorrection(): CorrectionResult {
  console.log('🚀 === INICIANDO CORREÇÃO COMPLETA DOS DADOS CRM ===');
  
  const timestamp = new Date().toISOString();
  const corrections = {
    clienteIdFixed: 0,
    clienteIdRestored: 0,
    clientsCreated: 0,
    calculationsFixed: 0,
    duplicatesRemoved: 0,
    nanValuesFixed: 0
  };
  const errors: string[] = [];
  
  try {
    // 1. AUDITORIA PRÉ-CORREÇÃO
    const auditReport = performFullDataAudit();
    console.log('📊 Problemas identificados antes da correção:', {
      clienteIdMissing: auditReport.problems.clienteIdMissing.length,
      valorNaN: auditReport.problems.valorNaN.length,
      inconsistentCalculations: auditReport.problems.inconsistentCalculations.length
    });
    
    // Carregar dados
    let clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    let workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    let workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    // 2. CORRIGIR CLIENTEID CORROMPIDOS
    workflowItems = workflowItems.map(item => {
      let correctedItem = { ...item };
      
      // Limpar clienteId corrompido
      if (correctedItem.clienteId && typeof correctedItem.clienteId === 'object') {
        console.log(`🔧 Removendo clienteId corrompido: ${correctedItem.nome}`);
        correctedItem.clienteId = undefined;
        corrections.clienteIdFixed++;
      }
      
      return correctedItem;
    });
    
    // 3. RESTAURAR CLIENTEID POR NOME
    workflowItems = workflowItems.map(item => {
      if (!item.clienteId && item.nome) {
        const clienteEncontrado = findClientByName(item.nome, clientes);
        if (clienteEncontrado) {
          console.log(`🎯 ClienteId restaurado: ${item.nome} → ${clienteEncontrado.id}`);
          corrections.clienteIdRestored++;
          return { ...item, clienteId: clienteEncontrado.id };
        }
      }
      return item;
    });
    
    // 4. CRIAR CLIENTES AUTOMATICAMENTE PARA WORKFLOWS ÓRFÃOS
    const workflowsOrfaos = workflowItems.filter(item => !item.clienteId && item.nome);
    
    for (const workflowOrfao of workflowsOrfaos) {
      const novoCliente: Cliente = {
        id: `cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nome: workflowOrfao.nome,
        telefone: workflowOrfao.whatsapp || '+55 (11) 99999-9999',
        email: workflowOrfao.email || `${normalizeClientName(workflowOrfao.nome).replace(/\s/g, '')}@email.com`,
        endereco: ''
      };
      
      clientes.push(novoCliente);
      corrections.clientsCreated++;
      
      console.log(`👤 Cliente criado automaticamente: ${novoCliente.nome} (${novoCliente.id})`);
      
      // Atualizar workflow com novo clienteId
      const index = workflowItems.findIndex(item => item.id === workflowOrfao.id);
      if (index !== -1) {
        workflowItems[index] = { ...workflowItems[index], clienteId: novoCliente.id };
      }
    }
    
    // 5. CORRIGIR CÁLCULOS FINANCEIROS
    workflowItems = workflowItems.map(item => {
      let correctedItem = { ...item };
      let wasFixed = false;
      
      // Corrigir valores NaN
      if (isNaN(correctedItem.total)) {
        correctedItem.total = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.valorPago)) {
        correctedItem.valorPago = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.valorPacote)) {
        correctedItem.valorPacote = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.valorTotalFotoExtra)) {
        correctedItem.valorTotalFotoExtra = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.valorTotalProduto)) {
        correctedItem.valorTotalProduto = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.valorAdicional)) {
        correctedItem.valorAdicional = 0;
        wasFixed = true;
      }
      if (isNaN(correctedItem.desconto)) {
        correctedItem.desconto = 0;
        wasFixed = true;
      }
      
      if (wasFixed) {
        corrections.nanValuesFixed++;
      }
      
      // Recalcular total se necessário
      const expectedTotal = (correctedItem.valorPacote || 0) + 
                           (correctedItem.valorTotalFotoExtra || 0) + 
                           (correctedItem.valorTotalProduto || 0) + 
                           (correctedItem.valorAdicional || 0) - 
                           (correctedItem.desconto || 0);
      
      if (Math.abs(correctedItem.total - expectedTotal) > 0.01) {
        console.log(`💰 Corrigindo total: ${correctedItem.nome} - ${correctedItem.total} → ${expectedTotal}`);
        correctedItem.total = expectedTotal;
        correctedItem.restante = expectedTotal - (correctedItem.valorPago || 0);
        corrections.calculationsFixed++;
      }
      
      return correctedItem;
    });
    
    // 6. UNIFICAR DADOS: WORKFLOW_SESSIONS COMO FONTE ÚNICA
    console.log('🔄 Unificando dados em workflow_sessions...');
    
    // Converter workflowItems para formato de sessions
    const unifiedSessions = workflowItems.map(item => ({
      id: item.id,
      data: item.data,
      hora: item.hora || '',
      nome: item.nome || '',
      whatsapp: item.whatsapp || '',
      email: item.email || '',
      descricao: item.descricao || '',
      status: item.status || '',
      categoria: item.categoria || '',
      clienteId: item.clienteId,
      pacote: item.pacote || '',
      valorPacote: item.valorPacote || 0,
      desconto: item.desconto || 0,
      valorFotoExtra: item.valorFotoExtra || 0,
      qtdFotoExtra: item.qtdFotoExtra || 0,
      valorTotalFotoExtra: item.valorTotalFotoExtra || 0,
      produto: item.produto || '',
      qtdProduto: item.qtdProduto || 0,
      valorTotalProduto: item.valorTotalProduto || 0,
      produtosList: item.produtosList || [],
      valorAdicional: item.valorAdicional || 0,
      detalhes: item.detalhes || '',
      total: item.total || 0,
      valorPago: item.valorPago || 0,
      restante: (item.total || 0) - (item.valorPago || 0),
      pagamentos: item.pagamentos || [],
      fonte: item.fonte || 'agenda',
      dataOriginal: item.dataOriginal
    }));
    
    // 7. ELIMINAR DUPLICAÇÕES
    const uniqueSessions = unifiedSessions.reduce((acc, session) => {
      const existingIndex = acc.findIndex(s => s.id === session.id);
      if (existingIndex === -1) {
        acc.push(session);
      } else {
        // Manter a versão mais completa
        if (session.clienteId && !acc[existingIndex].clienteId) {
          acc[existingIndex] = session;
          corrections.duplicatesRemoved++;
        }
      }
      return acc;
    }, [] as any[]);
    
    // 8. SALVAR DADOS CORRIGIDOS
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, []); // Limpar para evitar conflitos
    localStorage.setItem('workflow_sessions', JSON.stringify(uniqueSessions));
    
    // 9. MARCAR CORREÇÃO COMO CONCLUÍDA
    localStorage.setItem('crm_data_corrected', timestamp);
    
    console.log('✅ CORREÇÃO COMPLETA CONCLUÍDA:', corrections);
    
    return {
      timestamp,
      corrections,
      errors,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Erro durante correção de dados:', error);
    errors.push(`Erro durante correção: ${error}`);
    
    return {
      timestamp,
      corrections,
      errors,
      success: false
    };
  }
}

/**
 * Função para validar correção
 */
export function validateCorrection(): boolean {
  console.log('🔍 Validando correção dos dados...');
  
  const auditReport = performFullDataAudit();
  
  const isValid = (
    auditReport.problems.clienteIdMissing.length === 0 &&
    auditReport.problems.clienteIdCorrupted.length === 0 &&
    auditReport.problems.valorNaN.length === 0 &&
    auditReport.problems.inconsistentCalculations.length === 0
  );
  
  if (isValid) {
    console.log('✅ Todos os dados foram corrigidos com sucesso!');
  } else {
    console.log('⚠️ Ainda há problemas nos dados:', {
      clienteIdMissing: auditReport.problems.clienteIdMissing.length,
      clienteIdCorrupted: auditReport.problems.clienteIdCorrupted.length,
      valorNaN: auditReport.problems.valorNaN.length,
      inconsistentCalculations: auditReport.problems.inconsistentCalculations.length
    });
  }
  
  return isValid;
}

/**
 * Função para executar correção se necessária
 */
export function runCorrectionIfNeeded(): boolean {
  const lastCorrection = localStorage.getItem('crm_data_corrected');
  const now = new Date().getTime();
  const oneHour = 60 * 60 * 1000;
  
  // Executar se nunca foi executada ou se passou mais de 1 hora
  if (!lastCorrection || (now - new Date(lastCorrection).getTime()) > oneHour) {
    console.log('🚀 Executando correção automática dos dados...');
    const result = performCompleteDataCorrection();
    return result.success;
  }
  
  console.log('✅ Correção já executada recentemente');
  return true;
}