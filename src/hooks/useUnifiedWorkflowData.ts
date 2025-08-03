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
 * - AppContext.workflowItems (via storage utility)  
 * - workflow_sessions (localStorage direto)
 * 
 * Deduplica dados e garante formato consistente para o dashboard
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

  // Dados unificados e deduplicados
  const unifiedWorkflowData = useMemo(() => {
    console.log('🔄 Unificando dados do workflow...');
    console.log('📊 WorkflowItems (AppContext):', workflowItems.length);
    console.log('📊 WorkflowSessions (localStorage):', workflowSessions.length);

    const allItems = new Map<string, WorkflowItem>();

    // 1. PRIMEIRO: Adicionar dados de workflow_sessions (valores base)
    workflowSessions.forEach(session => {
      const normalizedItem = normalizeSessionToWorkflowItem(session);
      allItems.set(session.id, normalizedItem);
      
      console.log(`📝 Session ${session.id} adicionada: R$ ${normalizedItem.total} (fonte: ${normalizedItem.fonte})`);
    });

    // 2. SEGUNDO: Priorizar e sobrescrever com workflowItems (valores atualizados)
    workflowItems.forEach(item => {
      const existingItem = allItems.get(item.id);
      
      if (existingItem) {
        console.log(`🔄 Sobrescrevendo item ${item.id}:`, {
          valorAnterior: existingItem.total,
          novoValor: item.total,
          diferenca: item.total - existingItem.total
        });
      } else {
        console.log(`➕ Novo item do workflow: ${item.id} - R$ ${item.total}`);
      }
      
      allItems.set(item.id, item);
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