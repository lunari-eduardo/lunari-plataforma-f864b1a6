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

  // Dados unificados e deduplicados com PRIORIZAÇÃO ABSOLUTA DO WORKFLOW
  const unifiedWorkflowData = useMemo(() => {
    console.log('🔄 UNIFICAÇÃO CORRIGIDA - Workflow como fonte autoritativa...');
    console.log('📊 WorkflowItems (PRIORITÁRIO):', workflowItems.length);
    console.log('📊 WorkflowSessions (BACKUP):', workflowSessions.length);

    const allItems = new Map<string, WorkflowItem>();

    // ETAPA 1: Carregar dados base de workflow_sessions
    workflowSessions.forEach(session => {
      const normalizedItem = normalizeSessionToWorkflowItem(session);
      allItems.set(session.id, normalizedItem);
      
      console.log(`📦 Base carregada - Session ${session.id}: R$ ${normalizedItem.total}`);
    });

    // ETAPA 2: SOBRESCREVER ABSOLUTO com workflowItems (FONTE AUTORITATIVA)
    workflowItems.forEach(item => {
      const existingBase = allItems.get(item.id);
      
      if (existingBase) {
        const diferencaValor = item.total - existingBase.total;
        console.log(`🔥 WORKFLOW SOBRESCREVE item ${item.id}:`, {
          valorBase: existingBase.total,
          valorWorkflow: item.total,
          diferenca: diferencaValor,
          status: diferencaValor !== 0 ? '⚠️ VALOR ATUALIZADO' : '✅ VALOR MANTIDO'
        });
      } else {
        console.log(`➕ NOVO ITEM WORKFLOW: ${item.id} - R$ ${item.total}`);
      }
      
      // SOBRESCREVER SEMPRE - Workflow é autoritativo
      allItems.set(item.id, {
        ...item,
        fonte: item.fonte || 'agenda', // Garantir fonte
        dataOriginal: item.dataOriginal || parseDateFromStorage(item.data)
      });
    });

    const resultado = Array.from(allItems.values());
    
    // Debug detalhado dos valores
    const totalFaturado = resultado.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalPago = resultado.reduce((acc, item) => acc + (item.valorPago || 0), 0);
    
    console.log('✅ Dados unificados - ANÁLISE FINANCEIRA:', {
      total: resultado.length,
      totalFaturado: totalFaturado,
      totalPago: totalPago,
      aReceber: totalFaturado - totalPago,
      porFonte: {
        agenda: resultado.filter(i => i.fonte === 'agenda').length,
        orcamento: resultado.filter(i => i.fonte === 'orcamento').length
      },
      amostrasFinanceiras: resultado.slice(0, 5).map(i => ({ 
        id: i.id, 
        nome: i.nome, 
        total: i.total,
        valorPago: i.valorPago, 
        fonte: i.fonte 
      }))
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