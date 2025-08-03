import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { WorkflowItem, ProdutoWorkflow } from '@/contexts/AppContext';
import { parseDateFromStorage } from '@/utils/dateUtils';

interface WorkflowSessionData {
  id: string;
  data: string;
  hora: string;
  nome: string;
  whatsapp: string;
  email: string;
  descricao: string;
  status: string;
  categoria: string;
  pacote: string;
  valorPacote: string;
  desconto: number;
  valorFotoExtra: string;
  qtdFotosExtra: number;
  valorTotalFotoExtra: string;
  produto: string;
  qtdProduto: number;
  valorTotalProduto: string;
  valorAdicional: string;
  detalhes: string;
  valor: string;
  total: string;
  valorPago: string;
  restante: string;
  pagamentos: Array<{id: string; valor: number; data: string}>;
  fonte?: 'agenda' | 'orcamento';
  dataOriginal?: Date;
  produtosList?: ProdutoWorkflow[];
}

/**
 * Hook unificado para acessar dados do workflow de múltiplas fontes
 * 
 * PRIORIZAÇÃO DE DADOS (CORRIGIDA):
 * 1. workflowItems do AppContext (FONTE AUTORITATIVA - valores mais atualizados)
 * 2. workflow_sessions do localStorage (valores base/históricos)
 * 
 * GARANTIAS:
 * - Workflow é sempre a fonte única da verdade para o CRM
 * - Valores atualizados no workflow sobrescrevem dados antigos
 * - Sincronização bidirecional entre todas as fontes
 */
export function useUnifiedWorkflowData() {
  const { workflowItems } = useAppContext();
  const [workflowSessions, setWorkflowSessions] = useState<WorkflowSessionData[]>([]);

  // Carregar dados de workflow_sessions do localStorage
  useEffect(() => {
    const loadWorkflowSessions = () => {
      try {
        const saved = localStorage.getItem('workflow_sessions');
        const sessions = saved ? JSON.parse(saved) : [];
        setWorkflowSessions(sessions);
        
        console.log('📂 Workflow Sessions carregadas:', sessions.length);
      } catch (error) {
        console.error('❌ Erro ao carregar workflow_sessions:', error);
        setWorkflowSessions([]);
      }
    };

    loadWorkflowSessions();
    
    // Escutar mudanças no localStorage (para sincronização entre abas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'workflow_sessions') {
        loadWorkflowSessions();
      }
    };
    
    // Escutar mudanças diretas no workflow_sessions (via MutationObserver)
    const checkForChanges = () => {
      loadWorkflowSessions();
    };
    
    const intervalId = setInterval(checkForChanges, 1000); // Verificar a cada segundo
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  // Função para converter valores monetários formatados para números
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    // Remove "R$", espaços, pontos (milhares) e substitui vírgula por ponto
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Função para normalizar WorkflowSessionData para WorkflowItem
  const normalizeSessionToWorkflowItem = (session: WorkflowSessionData): WorkflowItem => {
    const valorPacote = parseMonetaryValue(session.valorPacote || session.valor);
    const valorPago = parseMonetaryValue(session.valorPago);
    const total = parseMonetaryValue(session.total || session.valor);
    
    return {
      id: session.id,
      data: session.data,
      hora: session.hora || '',
      nome: session.nome || '',
      whatsapp: session.whatsapp || '',
      email: session.email || '',
      descricao: session.descricao || '',
      status: session.status || '',
      categoria: session.categoria || '',
      pacote: session.pacote || '',
      valorPacote: valorPacote,
      desconto: session.desconto || 0,
      valorFotoExtra: parseMonetaryValue(session.valorFotoExtra),
      qtdFotoExtra: session.qtdFotosExtra || 0,
      valorTotalFotoExtra: parseMonetaryValue(session.valorTotalFotoExtra),
      produto: session.produto || '',
      qtdProduto: session.qtdProduto || 0,
      valorTotalProduto: parseMonetaryValue(session.valorTotalProduto),
      produtosList: (session.produtosList || []).map(p => ({
        nome: p.nome,
        quantidade: p.quantidade,
        valorUnitario: p.valorUnitario,
        tipo: (p.tipo === 'incluso' || p.tipo === 'manual') ? p.tipo : 'manual' as const
      })),
      valorAdicional: parseMonetaryValue(session.valorAdicional),
      detalhes: session.detalhes || '',
      total: total,
      valorPago: valorPago,
      restante: total - valorPago,
      pagamentos: session.pagamentos || [],
      fonte: session.fonte || 'agenda',
      dataOriginal: session.dataOriginal ? new Date(session.dataOriginal) : parseDateFromStorage(session.data)
    };
  };

  // Dados unificados - WORKFLOW ITEMS COMO FONTE ABSOLUTA DE VERDADE
  const unifiedWorkflowData = useMemo(() => {
    console.log('🎯 FORÇA TOTAL DO WORKFLOW - Priorização absoluta dos workflowItems...');
    console.log('📊 WorkflowItems (FONTE AUTORITATIVA):', workflowItems.length);
    console.log('📦 WorkflowSessions (BACKUP APENAS):', workflowSessions.length);

    // ESTRATÉGIA DEFINITIVA: workflowItems sempre sobrescrevem qualquer outra fonte
    const allItems = new Map<string, WorkflowItem>();

    // 1. PRIORIDADE ABSOLUTA: workflowItems (dados ATUAIS e CORRETOS)
    workflowItems.forEach(item => {
      console.log(`🎯 WORKFLOW ITEM AUTORITATIVO - ${item.nome || item.id}:`, {
        id: item.id,
        total: item.total,
        valorPago: item.valorPago || 0,
        aReceber: (item.total || 0) - (item.valorPago || 0),
        fonte: item.fonte || 'agenda',
        clienteId: item.clienteId
      });
      
      // Garantir que item.total está definido e válido
      const totalValidado = typeof item.total === 'number' ? item.total : 0;
      const valorPagoValidado = typeof item.valorPago === 'number' ? item.valorPago : 0;
      
      allItems.set(item.id, {
        ...item,
        total: totalValidado, // Garantir valor numérico
        valorPago: valorPagoValidado,
        restante: totalValidado - valorPagoValidado,
        fonte: item.fonte || 'agenda',
        dataOriginal: item.dataOriginal || parseDateFromStorage(item.data)
      });
    });

    // 2. FALLBACK: workflowSessions APENAS para itens que NÃO existem no workflow
    let sessionsAdicionadas = 0;
    workflowSessions.forEach(session => {
      if (!allItems.has(session.id)) {
        const normalizedItem = normalizeSessionToWorkflowItem(session);
        allItems.set(session.id, normalizedItem);
        sessionsAdicionadas++;
        console.log(`📦 Session órfã adicionada: ${session.id} - R$ ${normalizedItem.total}`);
      } else {
        console.log(`⚠️ Session ignorada (workflow tem prioridade): ${session.id}`);
      }
    });

    const resultado = Array.from(allItems.values());
    
    // Validação específica para clientes mencionados
    const eduardo = resultado.find(item => item.nome?.toLowerCase().includes('eduardo'));
    const lise = resultado.find(item => item.nome?.toLowerCase().includes('lise'));
    
    if (eduardo) {
      console.log('🔍 EDUARDO ENCONTRADO:', {
        id: eduardo.id,
        nome: eduardo.nome,
        total: eduardo.total,
        valorPago: eduardo.valorPago,
        fonte: eduardo.fonte,
        clienteId: eduardo.clienteId
      });
    }
    
    if (lise) {
      console.log('🔍 LISE ENCONTRADA:', {
        id: lise.id,
        nome: lise.nome,
        total: lise.total,
        valorPago: lise.valorPago,
        fonte: lise.fonte,
        clienteId: lise.clienteId
      });
    }
    
    // Debug final
    const totalGeral = resultado.reduce((acc, item) => acc + (item.total || 0), 0);
    const pagoGeral = resultado.reduce((acc, item) => acc + (item.valorPago || 0), 0);
    
    console.log('✅ DADOS UNIFICADOS - ANÁLISE COMPLETA:', {
      totalItens: resultado.length,
      workflowItemsProcessados: workflowItems.length,
      sessionsAdicionadas,
      totalGeral,
      pagoGeral,
      aReceberGeral: totalGeral - pagoGeral,
      distribuicaoPorFonte: {
        agenda: resultado.filter(i => i.fonte === 'agenda').length,
        orcamento: resultado.filter(i => i.fonte === 'orcamento').length
      }
    });

    return resultado;
  }, [workflowItems, workflowSessions]);

  // Função para filtrar por ano
  const filterByYear = (year: number) => {
    return unifiedWorkflowData.filter(item => {
      try {
        const itemYear = new Date(item.data).getFullYear();
        return itemYear === year;
      } catch {
        return false;
      }
    });
  };

  // Função para obter anos disponíveis
  const getAvailableYears = () => {
    const years = new Set<number>();
    
    unifiedWorkflowData.forEach(item => {
      try {
        const year = new Date(item.data).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      } catch {
        // Ignorar itens com data inválida
      }
    });

    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }

    return Array.from(years).sort((a, b) => b - a);
  };

  // Função para sincronizar mudanças do workflow_sessions de volta para o AppContext
  const syncWorkflowSessionsToContext = () => {
    try {
      const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      if (sessions.length > 0) {
        // Disparar evento customizado para o AppContext sincronizar
        window.dispatchEvent(new CustomEvent('workflowSessionsUpdated', { detail: sessions }));
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar workflow_sessions para contexto:', error);
    }
  };

  return {
    unifiedWorkflowData,
    workflowItems, // Para compatibilidade
    workflowSessions,
    filterByYear,
    getAvailableYears,
    parseMonetaryValue,
    syncWorkflowSessionsToContext
  };
}