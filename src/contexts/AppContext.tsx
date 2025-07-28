import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { FinancialEngine, CreateTransactionInput } from '@/services/FinancialEngine';
import { calculateTotals, calculateTotalsNew } from '@/services/FinancialCalculationEngine';
import { autoMigrateIfNeeded } from '@/utils/dataMoveMigration';
import { ClienteRelationshipManager } from '@/services/ClienteRelationshipManager';
import { clienteRegistry } from '@/services/ClienteRegistry';

// Types
import { Orcamento, Template, OrigemCliente, MetricasOrcamento, Cliente } from '@/types/orcamentos';
import { Appointment, AppointmentStatus } from '@/hooks/useAgenda';

export interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

export interface WorkflowItem {
  id: string;
  clienteId?: string; // ID que associa ao cliente da lista lunari_clients
  data: string;
  hora: string;
  nome: string;
  whatsapp: string;
  email: string;
  descricao: string;
  status: string;
  categoria: string;
  pacote: string;
  valorPacote: number;
  desconto: number;
  valorFotoExtra: number;
  qtdFotoExtra: number;
  valorTotalFotoExtra: number;
  produto: string; // Mantido para compatibilidade
  qtdProduto: number; // Mantido para compatibilidade
  valorTotalProduto: number; // Mantido para compatibilidade
  produtosList?: ProdutoWorkflow[]; // NOVA LISTA COMPLETA DE PRODUTOS
  valorAdicional: number;
  detalhes: string;
  total: number;
  valorPago: number;
  restante: number;
  pagamentos: Array<{id: string; valor: number; data: string}>;
  fonte: 'agenda' | 'orcamento';
  dataOriginal: Date;
}

interface WorkflowFilters {
  mes: string;
  busca: string;
}

interface AppContextType {
  // Orçamentos
  orcamentos: Orcamento[];
  templates: Template[];
  origens: OrigemCliente[];
  clientes: Cliente[];
  categorias: string[];
  produtos: any[];
  pacotes: any[];
  metricas: MetricasOrcamento;
  
  // Agenda
  appointments: Appointment[];
  
  // Workflow
  workflowItems: WorkflowItem[];
  allWorkflowItems: WorkflowItem[]; // NOVO: Lista completa sem filtros para CRM
  workflowSummary: { receita: number; aReceber: number; previsto: number };
  workflowFilters: WorkflowFilters;
  visibleColumns: Record<string, boolean>;
  
  // Cartões de Crédito (NOVO)
  cartoes: Array<{
    id: string;
    nome: string;
    diaVencimento: number;
    diaFechamento: number;
    ativo: boolean;
  }>;
  
  // Orçamentos Actions
  adicionarOrcamento: (orcamento: Omit<Orcamento, 'id' | 'criadoEm'>) => Orcamento;
  atualizarOrcamento: (id: string, orcamento: Partial<Orcamento>) => void;
  excluirOrcamento: (id: string) => void;
  adicionarTemplate: (template: Omit<Template, 'id'>) => Template;
  atualizarTemplate: (id: string, template: Partial<Template>) => void;
  excluirTemplate: (id: string) => void;
  definirTemplatePadrao: (id: string) => void;
  adicionarOrigem: (origem: Omit<OrigemCliente, 'id'>) => OrigemCliente;
  atualizarOrigem: (id: string, origem: Partial<OrigemCliente>) => void;
  excluirOrigem: (id: string) => void;
  adicionarCliente: (cliente: Omit<Cliente, 'id'>) => Cliente;
  atualizarCliente: (id: string, dadosAtualizados: Partial<Cliente>) => void;
  removerCliente: (id: string) => void;
  adicionarCategoria: (categoria: string) => void;
  removerCategoria: (categoria: string) => void;
  
  // Agenda Actions
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Appointment;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  
  // Workflow Actions
  addWorkflowItem: (item: Omit<WorkflowItem, 'id'>) => void;
  updateWorkflowItem: (id: string, updates: Partial<WorkflowItem>) => void;
  addPayment: (id: string, valor: number) => void;
  toggleColumnVisibility: (column: string) => void;
  updateWorkflowFilters: (newFilters: Partial<WorkflowFilters>) => void;
  navigateMonth: (direction: number) => void;
  
  // Integration utility functions
  isFromBudget: (appointment: Appointment) => boolean;
  getBudgetId: (appointment: Appointment) => string | undefined;
  canEditFully: (appointment: Appointment) => boolean;
  
  // Cartões de Crédito Actions (NOVO)
  adicionarCartao: (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => void;
  atualizarCartao: (id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => void;
  removerCartao: (id: string) => void;
  
  // Motor Financeiro Centralizado (NOVO)
  createTransactionEngine: (input: CreateTransactionInput) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Helper functions for appointments serialization
const serializeAppointments = (appointments: Appointment[]): any[] => {
  return appointments.map(app => ({
    ...app,
    date: app.date instanceof Date && !isNaN(app.date.getTime()) ? formatDateForStorage(app.date) : 
          (typeof app.date === 'string' ? app.date : getCurrentDateString())
  }));
};

const deserializeAppointments = (serializedAppointments: any[]): Appointment[] => {
  return serializedAppointments.map(app => ({
    ...app,
    date: parseDateFromStorage(app.date)
  }));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Orçamentos State com migração automática
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() => {
    const orcamentosRaw = storage.load(STORAGE_KEYS.BUDGETS, []);
    const pacotesConfig = storage.load('configuracoes_pacotes', []);
    const produtosConfig = storage.load('configuracoes_produtos', []);
    
    // Executar migração automática se necessário
    return autoMigrateIfNeeded(orcamentosRaw, pacotesConfig, produtosConfig);
  });
  
  const [templates, setTemplates] = useState<Template[]>(() => {
    return storage.load(STORAGE_KEYS.TEMPLATES, []);
  });
  
  const [origens, setOrigens] = useState<OrigemCliente[]>(() => {
    return storage.load(STORAGE_KEYS.ORIGINS, []);
  });
  
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    return storage.load(STORAGE_KEYS.CLIENTS, []);
  });
  
  const [categorias, setCategorias] = useState<string[]>(() => {
    const configCategorias = storage.load('configuracoes_categorias', []);
    return configCategorias.map((cat: any) => cat.nome || cat);
  });

  const [produtos, setProdutos] = useState(() => {
    return storage.load('configuracoes_produtos', []);
  });

  const [pacotes, setPacotes] = useState(() => {
    return storage.load('configuracoes_pacotes', []);
  });

  const [metricas, setMetricas] = useState<MetricasOrcamento>({
    totalMes: 0,
    enviados: 0,
    fechados: 0,
    cancelados: 0,
    pendentes: 0,
    taxaConversao: 0
  });

  // Agenda State
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const stored = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
    return stored.length > 0 ? deserializeAppointments(stored) : [];
  });

  // Workflow State - NOVA ARQUITETURA: Lista unificada persistente
  const [allWorkflowItems, setAllWorkflowItems] = useState<WorkflowItem[]>(() => {
    const items = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    console.log('🔄 Nova Arquitetura - Workflow items carregados:', {
      'total itens': items.length,
      'primeiro item': items[0] || 'nenhum'
    });
    return items;
  });
  
  const [workflowFilters, setWorkflowFilters] = useState<WorkflowFilters>(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-');
    return {
      mes: `${parseInt(mes)}/${ano}`,
      busca: ''
    };
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    return storage.load(STORAGE_KEYS.WORKFLOW_COLUMNS, {
      data: true,
      hora: true,
      nome: true,
      adicionarPagamento: true,
      descricao: true,
      whatsapp: false,
      email: false,
      status: true,
      categoria: true,
      pacote: true,
      valorPacote: true,
      desconto: false,
      valorFotoExtra: false,
      qtdFotoExtra: false,
      valorTotalFotoExtra: false,
      produto: false,
      qtdProduto: false,
      valorTotalProduto: false,
      valorAdicional: false,
      detalhes: false,
      total: true,
      valorPago: true,
      restante: true
    });
  });

  // Estado dos Cartões de Crédito (NOVO) - Agora usando FinancialEngine
  const [cartoes, setCartoes] = useState(() => {
    return FinancialEngine.loadCreditCards();
  });

  // Utility functions
  const isFromBudget = useCallback((appointment: Appointment) => {
    return appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento';
  }, []);
  
  const getBudgetId = useCallback((appointment: Appointment) => {
    if (appointment.id?.startsWith('orcamento-')) {
      return appointment.id.replace('orcamento-', '');
    }
    return (appointment as any).orcamentoId;
  }, []);
  
  const canEditFully = useCallback((appointment: Appointment) => {
    return !(appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento');
  }, []);

  // Helper function to safely get a valid date
  const getSafeDate = (item: WorkflowItem): Date => {
    // Try dataOriginal first
    if (item.dataOriginal && item.dataOriginal instanceof Date && !isNaN(item.dataOriginal.getTime())) {
      return item.dataOriginal;
    }
    
    // Try parsing from data string
    try {
      const parsedDate = parseDateFromStorage(item.data);
      if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch (error) {
      console.warn('Failed to parse date for item:', item.id, error);
    }
    
    // Fallback to current date
    return new Date();
  };

  // Transform functions for unified workflow
  const transformAppointmentToWorkflow = useCallback((appointment: Appointment): WorkflowItem => {
    const dateStr = appointment.date instanceof Date ? 
      formatDateForStorage(appointment.date) : 
      appointment.date;
    
    return {
      id: appointment.id,
      clienteId: appointment.clientId,
      data: dateStr,
      hora: appointment.time,
      nome: appointment.client,
      whatsapp: appointment.whatsapp || '',
      email: appointment.email || '',
      descricao: appointment.description || appointment.type,
      status: '',
      categoria: appointment.type.includes('Gestante') ? 'Gestante' : 
                 appointment.type.includes('Família') ? 'Família' : 
                 appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros',
      pacote: appointment.type,
      valorPacote: 0,
      desconto: 0,
      valorFotoExtra: 0,
      qtdFotoExtra: 0,
      valorTotalFotoExtra: 0,
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 0,
      produtosList: appointment.produtosIncluidos?.map(p => ({
        nome: p.nome,
        quantidade: p.quantidade,
        valorUnitario: p.valorUnitario,
        tipo: p.tipo
      })) || [],
      valorAdicional: 0,
      detalhes: appointment.description || '',
      total: appointment.paidAmount || 0,
      valorPago: appointment.paidAmount || 0,
      restante: 0,
      pagamentos: appointment.paidAmount ? [{
        id: 'p1',
        valor: appointment.paidAmount,
        data: getCurrentDateString()
      }] : [],
      fonte: 'agenda',
      dataOriginal: appointment.date instanceof Date ? appointment.date : parseDateFromStorage(dateStr)
    };
  }, []);

  // Computed values for workflow - NOVA ARQUITETURA: Apenas filtros da lista unificada
  const workflowItems = React.useMemo(() => {
    return allWorkflowItems.filter(item => {
      const itemDate = getSafeDate(item);
      const [mesNum, ano] = workflowFilters.mes.split('/').map(Number);
      
      return itemDate.getMonth() + 1 === mesNum && 
             itemDate.getFullYear() === ano &&
             (!workflowFilters.busca || 
              item.nome.toLowerCase().includes(workflowFilters.busca.toLowerCase()) ||
              item.email.toLowerCase().includes(workflowFilters.busca.toLowerCase()) ||
              item.descricao.toLowerCase().includes(workflowFilters.busca.toLowerCase()));
    });
  }, [allWorkflowItems, workflowFilters]);
  
  const workflowSummary = React.useMemo(() => {
    const summary = {
      receita: allWorkflowItems.reduce((sum, item) => sum + (item.valorPago || 0), 0),
      aReceber: allWorkflowItems.reduce((sum, item) => sum + (item.restante || 0), 0),
      previsto: allWorkflowItems.reduce((sum, item) => sum + (item.total || 0), 0)
    };
    console.log('📊 Workflow Summary calculated:', summary);
    return summary;
  }, [allWorkflowItems]);

  // Save effects - NOVA ARQUITETURA: Persistir apenas lista unificada
  useEffect(() => {
    storage.save(STORAGE_KEYS.BUDGETS, orcamentos);
    setMetricas({
      totalMes: orcamentos.reduce((sum, orc) => sum + (orc.valorFinal || 0), 0),
      enviados: orcamentos.filter(o => o.status === 'enviado').length,
      fechados: orcamentos.filter(o => o.status === 'fechado').length,
      cancelados: orcamentos.filter(o => o.status === 'cancelado').length,
      pendentes: orcamentos.filter(o => o.status === 'rascunho').length,
      taxaConversao: orcamentos.length > 0 ? 
        (orcamentos.filter(o => o.status === 'fechado').length / orcamentos.length) * 100 : 0
    });
  }, [orcamentos]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.TEMPLATES, templates);
  }, [templates]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.ORIGINS, origens);
  }, [origens]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
  }, [clientes]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.APPOINTMENTS, serializeAppointments(appointments));
  }, [appointments]);

  // NOVA ARQUITETURA: Persistir allWorkflowItems
  useEffect(() => {
    localStorage.setItem('lunari_workflow_items', JSON.stringify(allWorkflowItems));
  }, [allWorkflowItems]);

  useEffect(() => {
    console.log('💾 Salvando allWorkflowItems:', allWorkflowItems.length, 'itens');
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, allWorkflowItems);
  }, [allWorkflowItems]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.WORKFLOW_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  // Sincronizar cartões com FinancialEngine (NOVO)
  useEffect(() => {
    // Sincronizar o estado local com o FinancialEngine
    const engineCards = FinancialEngine.loadCreditCards();
    if (JSON.stringify(engineCards) !== JSON.stringify(cartoes)) {
      setCartoes(engineCards);
    }
  }, []);

  // Sync configuration data
  useEffect(() => {
    const syncConfigData = () => {
      const configCategorias = storage.load('configuracoes_categorias', []);
      const configProdutos = storage.load('configuracoes_produtos', []);
      const configPacotes = storage.load('configuracoes_pacotes', []);
      
      // Transform categorias from objects to string array
      const categoriasNomes = configCategorias.map((cat: any) => cat.nome || cat);
      if (categoriasNomes.length > 0) {
        setCategorias(categoriasNomes);
      }
      
      setProdutos(configProdutos);
      setPacotes(configPacotes);
    };

    const interval = setInterval(syncConfigData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Agenda functions - NOVA ARQUITETURA: Sincronização com workflow
  const addAppointment = useCallback((appointment: Omit<Appointment, 'id'>): Appointment => {
    const newAppointment: Appointment = {
      ...appointment,
      id: `appointment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    setAppointments(prev => {
      const updated = [...prev, newAppointment];
      return updated;
    });

    // NOVA ARQUITETURA: Se confirmado, criar WorkflowItem imediatamente
    if (newAppointment.status === 'confirmado') {
      const workflowItem = transformAppointmentToWorkflow(newAppointment);
      setAllWorkflowItems(prev => [...prev, workflowItem]);
      clienteRegistry.onDataChange(); // Sincronizar registry
      console.log('✅ Agendamento confirmado sincronizado com workflow:', workflowItem.id);
    }

    return newAppointment;
  }, [transformAppointmentToWorkflow]);

  const updateAppointment = useCallback((id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => {
      const updated = prev.map(app => {
        if (app.id === id) {
          const updatedApp = { ...app, ...updates };
          
          // NOVA ARQUITETURA: Sincronizar com workflow
          if (updatedApp.status === 'confirmado') {
            const workflowItem = transformAppointmentToWorkflow(updatedApp);
            setAllWorkflowItems(prevWorkflow => {
              const existingIndex = prevWorkflow.findIndex(item => item.id === id);
              if (existingIndex >= 0) {
                const newWorkflow = [...prevWorkflow];
                newWorkflow[existingIndex] = workflowItem;
                return newWorkflow;
              } else {
                return [...prevWorkflow, workflowItem];
              }
            });
            clienteRegistry.onDataChange(); // Sincronizar registry
            console.log('✅ Agendamento atualizado sincronizado com workflow:', id);
          } else if (app.status === 'confirmado' && updatedApp.status === 'a confirmar') {
            // Remove do workflow se não está mais confirmado
            setAllWorkflowItems(prevWorkflow => prevWorkflow.filter(item => item.id !== id));
            clienteRegistry.onDataChange(); // Sincronizar registry
            console.log('✅ Agendamento removido do workflow:', id);
          }
          
          return updatedApp;
        }
        return app;
      });
      return updated;
    });
  }, [transformAppointmentToWorkflow]);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => {
      const updated = prev.filter(app => app.id !== id);
      return updated;
    });
    
    // NOVA ARQUITETURA: Remover do workflow também
    setAllWorkflowItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      console.log('✅ WorkflowItem removido junto com agendamento:', id);
      return updated;
    });
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  // Workflow functions - NOVA ARQUITETURA: Persistência imediata
  const addWorkflowItem = useCallback((item: Omit<WorkflowItem, 'id'>) => {
    const newItem: WorkflowItem = {
      ...item,
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setAllWorkflowItems(prev => {
      const updated = [...prev, newItem];
      console.log('✅ Novo WorkflowItem adicionado:', newItem.id);
      return updated;
    });
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  const updateWorkflowItem = useCallback((id: string, updates: Partial<WorkflowItem>) => {
    setAllWorkflowItems(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      console.log('✅ WorkflowItem atualizado:', id, 'updates:', Object.keys(updates));
      return updated;
    });
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  const addPayment = useCallback((id: string, valor: number) => {
    setAllWorkflowItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const novoPagamento = {
            id: `pag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            valor,
            data: getCurrentDateString()
          };
          
          const pagamentosAtualizados = [...(item.pagamentos || []), novoPagamento];
          const novoValorPago = pagamentosAtualizados.reduce((sum, pag) => sum + pag.valor, 0);
          const novoRestante = item.total - novoValorPago;
          
          console.log('✅ Pagamento adicionado:', { id, valor, novoValorPago, novoRestante });
          
          return {
            ...item,
            pagamentos: pagamentosAtualizados,
            valorPago: novoValorPago,
            restante: Math.max(0, novoRestante)
          };
        }
        return item;
      });
      return updated;
    });
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  // Other workflow functions
  const toggleColumnVisibility = useCallback((column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  }, []);

  const updateWorkflowFilters = useCallback((newFilters: Partial<WorkflowFilters>) => {
    setWorkflowFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const navigateMonth = useCallback((direction: number) => {
    setWorkflowFilters(prev => {
      const [mes, ano] = prev.mes.split('/').map(Number);
      let novoMes = mes + direction;
      let novoAno = ano;
      
      if (novoMes > 12) {
        novoMes = 1;
        novoAno++;
      } else if (novoMes < 1) {
        novoMes = 12;
        novoAno--;
      }
      
      return { ...prev, mes: `${novoMes}/${novoAno}` };
    });
  }, []);

  // Budget functions
  const adicionarOrcamento = useCallback((orcamento: Omit<Orcamento, 'id' | 'criadoEm'>): Orcamento => {
    const novoOrcamento: Orcamento = {
      ...orcamento,
      id: `orc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      criadoEm: new Date().toISOString()
    };

    setOrcamentos(prev => [...prev, novoOrcamento]);
    return novoOrcamento;
  }, []);

  const atualizarOrcamento = useCallback((id: string, updates: Partial<Orcamento>) => {
    setOrcamentos(prev => prev.map(orc => orc.id === id ? { ...orc, ...updates } : orc));
  }, []);

  const excluirOrcamento = useCallback((id: string) => {
    setOrcamentos(prev => prev.filter(orc => orc.id !== id));
  }, []);

  // Template functions
  const adicionarTemplate = useCallback((template: Omit<Template, 'id'>): Template => {
    const novoTemplate: Template = {
      ...template,
      id: `template-${Date.now()}`
    };
    setTemplates(prev => [...prev, novoTemplate]);
    return novoTemplate;
  }, []);

  const atualizarTemplate = useCallback((id: string, updates: Partial<Template>) => {
    setTemplates(prev => prev.map(tpl => tpl.id === id ? { ...tpl, ...updates } : tpl));
  }, []);

  const excluirTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(tpl => tpl.id !== id));
  }, []);

  const definirTemplatePadrao = useCallback((id: string) => {
    setTemplates(prev => prev.map(tpl => ({ ...tpl, padrao: tpl.id === id })));
  }, []);

  // Origin functions
  const adicionarOrigem = useCallback((origem: Omit<OrigemCliente, 'id'>): OrigemCliente => {
    const novaOrigem: OrigemCliente = {
      ...origem,
      id: `origem-${Date.now()}`
    };
    setOrigens(prev => [...prev, novaOrigem]);
    return novaOrigem;
  }, []);

  const atualizarOrigem = useCallback((id: string, updates: Partial<OrigemCliente>) => {
    setOrigens(prev => prev.map(orig => orig.id === id ? { ...orig, ...updates } : orig));
  }, []);

  const excluirOrigem = useCallback((id: string) => {
    setOrigens(prev => prev.filter(orig => orig.id !== id));
  }, []);

  // Client functions
  const adicionarCliente = useCallback((cliente: Omit<Cliente, 'id'>): Cliente => {
    const novoCliente: Cliente = {
      ...cliente,
      id: `cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setClientes(prev => [...prev, novoCliente]);
    clienteRegistry.onDataChange(); // Sincronizar registry
    return novoCliente;
  }, []);

  const atualizarCliente = useCallback((id: string, dadosAtualizados: Partial<Cliente>) => {
    setClientes(prev => prev.map(cliente => 
      cliente.id === id ? { ...cliente, ...dadosAtualizados } : cliente
    ));
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  const removerCliente = useCallback((id: string) => {
    setClientes(prev => prev.filter(cliente => cliente.id !== id));
    clienteRegistry.onDataChange(); // Sincronizar registry
  }, []);

  // Category functions
  const adicionarCategoria = useCallback((categoria: string) => {
    setCategorias(prev => {
      if (!prev.includes(categoria)) {
        const updated = [...prev, categoria];
        storage.save('configuracoes_categorias', updated.map(cat => ({ nome: cat })));
        return updated;
      }
      return prev;
    });
  }, []);

  const removerCategoria = useCallback((categoria: string) => {
    setCategorias(prev => {
      const updated = prev.filter(cat => cat !== categoria);
      storage.save('configuracoes_categorias', updated.map(cat => ({ nome: cat })));
      return updated;
    });
  }, []);

  // Credit card functions
  const adicionarCartao = useCallback((cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => {
    try {
      const novoCartao = FinancialEngine.addCreditCard({
        nome: cartao.nome,
        diaVencimento: cartao.diaVencimento,
        diaFechamento: cartao.diaFechamento,
        userId: 'local-user',
        ativo: true
      });
      
      setCartoes(FinancialEngine.loadCreditCards());
      
      toast({
        title: "Cartão adicionado",
        description: `Cartão ${cartao.nome} foi adicionado com sucesso.`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o cartão.",
        variant: "destructive"
      });
    }
  }, []);

  const atualizarCartao = useCallback((id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => {
    // Para atualizações, vamos simular usando o estado local
    // Em uma implementação completa, seria necessário adicionar função updateCreditCard ao FinancialEngine
    setCartoes(prev => prev.map(cartao => 
      cartao.id === id ? { ...cartao, ...dadosAtualizados } : cartao
    ));
    
    // Persistir manualmente
    const updatedCards = cartoes.map(cartao => 
      cartao.id === id ? { ...cartao, ...dadosAtualizados } : cartao
    );
    localStorage.setItem('lunari_fin_credit_cards', JSON.stringify(updatedCards));
  }, []);

  const removerCartao = useCallback((id: string) => {
    const cartao = cartoes.find(c => c.id === id);
    
    try {
      FinancialEngine.removeCreditCard(id);
      setCartoes(FinancialEngine.loadCreditCards());
      
      if (cartao) {
        toast({
          title: "Cartão removido",
          description: `Cartão ${cartao.nome} foi removido.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o cartão.",
        variant: "destructive"
      });
    }
  }, []);

  // Financial engine function
  const createTransactionEngine = useCallback((input: CreateTransactionInput) => {
    try {
      const result = FinancialEngine.createTransactions(input);
      
      // Salvar transações criadas
      FinancialEngine.saveTransactions(result.transactions);
      
      // Salvar template recorrente se criado
      if (result.recurringTemplate) {
        FinancialEngine.saveRecurringTemplates([result.recurringTemplate]);
      }
      
      toast({
        title: "Lançamento criado",
        description: `${result.transactions.length} transação(ões) criada(s) com sucesso.`
      });
      
      return result;
    } catch (error) {
      console.error('Erro no motor financeiro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o lançamento.",
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const contextValue: AppContextType = {
    // Orçamentos
    orcamentos,
    templates,
    origens,
    clientes,
    categorias,
    produtos,
    pacotes,
    metricas,
    
    // Agenda
    appointments,
    
    // Workflow - NOVA ARQUITETURA
    workflowItems,
    allWorkflowItems,
    workflowSummary,
    workflowFilters,
    visibleColumns,
    
    // Cartões
    cartoes,
    
    // Orçamentos Actions
    adicionarOrcamento,
    atualizarOrcamento,
    excluirOrcamento,
    adicionarTemplate,
    atualizarTemplate,
    excluirTemplate,
    definirTemplatePadrao,
    adicionarOrigem,
    atualizarOrigem,
    excluirOrigem,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    adicionarCategoria,
    removerCategoria,
    
    // Agenda Actions
    addAppointment,
    updateAppointment,
    deleteAppointment,
    
    // Workflow Actions - NOVA ARQUITETURA
    addWorkflowItem,
    updateWorkflowItem,
    addPayment,
    toggleColumnVisibility,
    updateWorkflowFilters,
    navigateMonth,
    
    // Integration utilities
    isFromBudget,
    getBudgetId,
    canEditFully,
    
    // Cartões Actions
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    
    // Financial engine
    createTransactionEngine
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
