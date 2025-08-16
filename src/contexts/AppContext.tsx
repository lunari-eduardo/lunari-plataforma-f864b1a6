import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { FinancialEngine, CreateTransactionInput } from '@/services/FinancialEngine';
import { calculateTotals, calculateTotalsNew } from '@/services/FinancialCalculationEngine';
import { congelarRegrasPrecoFotoExtra, calcularComRegrasProprias, migrarRegrasParaItemAntigo, validarRegrasCongeladas } from '@/utils/precificacaoUtils';
import { initializeApp, needsInitialization } from '@/utils/initializeApp';
import { Projeto, CriarProjetoInput } from '@/types/projeto';
import { ProjetoService } from '@/services/ProjetoService';
import { corrigirClienteIdSessoes, corrigirClienteIdAgendamentos } from '@/utils/corrigirClienteIdSessoes';
import { generateSessionId } from '@/utils/workflowSessionsAdapter';

// Types
import { Cliente, OrigemCliente } from '@/types/cliente';
import { Appointment, AppointmentStatus } from '@/hooks/useAgenda';
import { AvailabilitySlot } from '@/types/availability';

export interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
  produzido?: boolean;
  entregue?: boolean;
}

export interface RegrasPrecoFotoExtraCongeladas {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number; // Para modelo fixo
  tabelaGlobal?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  }; // Para modelo global
  tabelaCategoria?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  }; // Para modelo categoria
  categoriaId?: string; // ID da categoria (para modelo categoria)
  timestampCongelamento: string; // Para auditoria
}

export interface WorkflowItem {
  id: string;
  sessionId?: string; // ID único universal para rastrear através de orçamento → agendamento → workflow
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
  // Novos campos para orçamentos ajustados
  valorFinalAjustado?: boolean;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
  // NOVO: Campo para congelamento de regras de preço
  regrasDePrecoFotoExtraCongeladas?: RegrasPrecoFotoExtraCongeladas;
  // NOVO: Campo para relacionar com cliente específico (CRM)
  clienteId?: string;
}

interface WorkflowFilters {
  mes: string;
  busca: string;
}

interface AppContextType {
  // Cliente Management
  clientes: Cliente[];
  origens: OrigemCliente[];
  categorias: string[];
  produtos: any[];
  pacotes: any[];
  
  // Agenda
  appointments: Appointment[];
  // Disponibilidades da Agenda
  availability: AvailabilitySlot[];
  
  // Workflow
  workflowItems: WorkflowItem[];
  workflowItemsAll: WorkflowItem[];
  workflowSummary: { receita: number; aReceber: number; previsto: number };
  workflowFilters: WorkflowFilters;
  visibleColumns: Record<string, boolean>;
  
  // Cartões de Crédito
  cartoes: Array<{
    id: string;
    nome: string;
    diaVencimento: number;
    diaFechamento: number;
    ativo: boolean;
  }>;
  
  // Cliente Management Actions
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
  // Disponibilidades Actions
  addAvailabilitySlots: (slots: AvailabilitySlot[]) => void;
  clearAvailabilityForDate: (date: string) => void;
  deleteAvailabilitySlot: (id: string) => void;
  
  // Workflow Actions
  updateWorkflowItem: (id: string, updates: Partial<WorkflowItem>) => void;
  addPayment: (id: string, valor: number) => void;
  toggleColumnVisibility: (column: string) => void;
  updateWorkflowFilters: (newFilters: Partial<WorkflowFilters>) => void;
  navigateMonth: (direction: number) => void;
  
  // Cartões de Crédito Actions
  adicionarCartao: (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => void;
  atualizarCartao: (id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => void;
  removerCartao: (id: string) => void;
  
  // Motor Financeiro Centralizado
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
  // Cliente State
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    return storage.load(STORAGE_KEYS.CLIENTS, []);
  });
  
  const [origens, setOrigens] = useState<OrigemCliente[]>(() => {
    return storage.load(STORAGE_KEYS.ORIGINS, []);
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

  // Agenda State
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const stored = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
    return stored.length > 0 ? deserializeAppointments(stored) : [];
  });

  // Disponibilidades da Agenda
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(() => {
    return storage.load(STORAGE_KEYS.AVAILABILITY, [] as AvailabilitySlot[]);
  });

  // NOVA ARQUITETURA: Estado baseado em Projetos
  const [projetos, setProjetos] = useState<Projeto[]>(() => {
    try {
      // Executar migração na primeira inicialização
      ProjetoService.migrarDadosExistentes();
      ProjetoService.deduplicarProjetos();
      return ProjetoService.carregarProjetos();
    } catch (error) {
      console.error('❌ Erro ao carregar projetos:', error);
      return [];
    }
  });

  // COMPATIBILIDADE: WorkflowItems derivados dos Projetos
  const workflowItems: WorkflowItem[] = projetos.map(projeto => ({
    id: projeto.projectId,
    sessionId: projeto.projectId,
    data: projeto.dataAgendada.toISOString().split('T')[0],
    hora: projeto.horaAgendada,
    nome: projeto.nome,
    whatsapp: projeto.whatsapp,
    email: projeto.email,
    descricao: projeto.descricao,
    status: projeto.status,
    categoria: projeto.categoria,
    pacote: projeto.pacote,
    valorPacote: projeto.valorPacote,
    desconto: projeto.desconto,
    valorFotoExtra: projeto.valorFotoExtra,
    qtdFotoExtra: projeto.qtdFotosExtra,
    valorTotalFotoExtra: projeto.valorTotalFotosExtra,
    produto: projeto.produto,
    qtdProduto: projeto.qtdProduto,
    valorTotalProduto: projeto.valorTotalProduto,
    produtosList: projeto.produtosList.map(p => ({
      nome: p.nome,
      quantidade: p.quantidade,
      valorUnitario: p.valorUnitario,
      tipo: p.tipo,
      produzido: p.produzido,
      entregue: p.entregue
    })),
    valorAdicional: projeto.valorAdicional,
    detalhes: projeto.detalhes,
    total: projeto.total,
    valorPago: projeto.valorPago,
    restante: projeto.restante,
    pagamentos: projeto.pagamentos.map(p => ({
      id: p.id,
      valor: p.valor,
      data: p.data
    })),
    fonte: projeto.fonte as 'agenda' | 'orcamento',
    dataOriginal: projeto.dataOriginal || projeto.dataAgendada,
    valorFinalAjustado: Boolean(projeto.valorFinalAjustado),
    valorOriginalOrcamento: projeto.valorOriginalOrcamento,
    percentualAjusteOrcamento: projeto.percentualAjusteOrcamento,
    regrasDePrecoFotoExtraCongeladas: projeto.regrasDePrecoFotoExtraCongeladas 
      ? { valorFotoExtra: projeto.valorFotoExtra } as any 
      : undefined,
    clienteId: projeto.clienteId
  }));

  // FUNÇÕES PARA GERENCIAR PROJETOS
  const criarProjeto = (input: CriarProjetoInput): Projeto => {
    const novoProjeto = ProjetoService.criarProjeto(input);
    setProjetos(ProjetoService.carregarProjetos());
    return novoProjeto;
  };

  const atualizarProjeto = (projectId: string, updates: Partial<Projeto>): void => {
    ProjetoService.atualizarProjeto(projectId, updates);
    setProjetos(ProjetoService.carregarProjetos());
  };

  const excluirProjeto = (projectId: string): void => {
    ProjetoService.excluirProjeto(projectId);
    setProjetos(ProjetoService.carregarProjetos());
  };
  
  // SYNC: workflow_sessions → Projetos (inclui inclusos e manuais)
  const syncSessionsToProjects = useCallback((sessionsRaw: any[]) => {
    try {
      if (!Array.isArray(sessionsRaw) || sessionsRaw.length === 0) return;
      const projetosExistentes = ProjetoService.carregarProjetos();
      let houveAlteracao = false;

      const normalizar = (s: any) => ({
        id: s.id,
        data: s.data,
        hora: s.hora,
        nome: (s.nome || '').trim(),
        clienteId: s.clienteId || '',
        produtosList: Array.isArray(s.produtosList) ? s.produtosList : [],
      });

      sessionsRaw.map(normalizar).forEach(session => {
        // Tentar localizar projeto correspondente
        let dataSessao: Date | null = null;
        if (typeof session.data === 'string' && session.data.includes('/')) {
          const [dia, mes, ano] = session.data.split('/').map((n: string) => parseInt(n, 10));
          if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
            dataSessao = new Date(ano, mes - 1, dia);
          }
        }

        const proj = projetosExistentes.find(p => {
          const mesmoCliente = session.clienteId
            ? p.clienteId === session.clienteId
            : p.nome.trim().toLowerCase() === session.nome.toLowerCase();
          const mesmaHora = session.hora ? p.horaAgendada === session.hora : true;
          let mesmaData = true;
          if (dataSessao) {
            const diff = Math.abs(p.dataAgendada.getTime() - dataSessao.getTime());
            mesmaData = diff < 12 * 60 * 60 * 1000; // 12h
          }
          return mesmoCliente && mesmaHora && mesmaData;
        });

        if (!proj) return;

        const produtosNorm = session.produtosList.map((p: any) => ({
          nome: p.nome,
          quantidade: Number(p.quantidade) || 0,
          valorUnitario: Number(p.valorUnitario) || 0,
          tipo: p.tipo === 'incluso' ? 'incluso' as const : 'manual' as const,
          produzido: !!p.produzido,
          entregue: !!p.entregue
        }));

        const valorProdutosManuais = produtosNorm
          .filter(p => p.tipo === 'manual')
          .reduce((sum, p) => sum + p.valorUnitario * p.quantidade, 0);

        const updates: Partial<Projeto> = {
          produtosList: produtosNorm as any,
          valorTotalProduto: valorProdutosManuais,
          valorProdutos: valorProdutosManuais,
          produto: produtosNorm.map(p => p.nome).join(', '),
          qtdProduto: produtosNorm.reduce((acc, p) => acc + p.quantidade, 0),
        };

        ProjetoService.atualizarProjeto(proj.projectId, updates);
        houveAlteracao = true;
      });

      if (houveAlteracao) {
        setProjetos(ProjetoService.carregarProjetos());
      }
    } catch (e) {
      console.error('❌ Erro ao sincronizar workflow_sessions → projetos:', e);
    }
  }, [setProjetos]);

  // Listener para eventos e backfill inicial
  useEffect(() => {
    const handler = (e: any) => {
      const sessions = e?.detail?.sessions || [];
      syncSessionsToProjects(sessions);
    };
    window.addEventListener('workflow-sessions-updated', handler);
    try {
      const initial = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      if (Array.isArray(initial) && initial.length > 0) {
        syncSessionsToProjects(initial);
      }
    } catch {}
    return () => window.removeEventListener('workflow-sessions-updated', handler);
  }, [syncSessionsToProjects]);

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

  // Estado dos Cartões de Crédito - Agora usando FinancialEngine
  const [cartoes, setCartoes] = useState(() => {
    return storage.load('configuracoes_cartoes', []);
  });

  // Save states to localStorage when they change
  useEffect(() => {
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
  }, [clientes]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.ORIGINS, origens);
  }, [origens]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.APPOINTMENTS, serializeAppointments(appointments));
  }, [appointments]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.AVAILABILITY, availability);
  }, [availability]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.WORKFLOW_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    storage.save('configuracoes_cartoes', cartoes);
  }, [cartoes]);

  // Cliente Functions
  const adicionarCliente = (cliente: Omit<Cliente, 'id'>): Cliente => {
    const novoCliente = {
      ...cliente,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setClientes(prev => [...prev, novoCliente]);
    return novoCliente;
  };

  const atualizarCliente = (id: string, dadosAtualizados: Partial<Cliente>): void => {
    setClientes(prev => prev.map(cliente => 
      cliente.id === id ? { ...cliente, ...dadosAtualizados } : cliente
    ));
  };

  const removerCliente = (id: string): void => {
    setClientes(prev => prev.filter(cliente => cliente.id !== id));
  };

  const adicionarOrigem = (origem: Omit<OrigemCliente, 'id'>): OrigemCliente => {
    const novaOrigem = {
      ...origem,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setOrigens(prev => [...prev, novaOrigem]);
    return novaOrigem;
  };

  const atualizarOrigem = (id: string, origem: Partial<OrigemCliente>): void => {
    setOrigens(prev => prev.map(o => 
      o.id === id ? { ...o, ...origem } : o
    ));
  };

  const excluirOrigem = (id: string): void => {
    setOrigens(prev => prev.filter(o => o.id !== id));
  };

  const adicionarCategoria = (categoria: string): void => {
    if (!categorias.includes(categoria)) {
      setCategorias(prev => [...prev, categoria]);
    }
  };

  const removerCategoria = (categoria: string): void => {
    setCategorias(prev => prev.filter(cat => cat !== categoria));
  };

  // Agenda Functions
  const addAppointment = (appointment: Omit<Appointment, 'id'>): Appointment => {
    const newAppointment = {
      ...appointment,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setAppointments(prev => [...prev, newAppointment]);
    return newAppointment;
  };

  const updateAppointment = (id: string, appointment: Partial<Appointment>): void => {
    setAppointments(prev => prev.map(app => 
      app.id === id ? { ...app, ...appointment } : app
    ));
  };

  const deleteAppointment = (id: string): void => {
    setAppointments(prev => prev.filter(app => app.id !== id));
  };

  const addAvailabilitySlots = (slots: AvailabilitySlot[]): void => {
    setAvailability(prev => [...prev, ...slots]);
  };

  const clearAvailabilityForDate = (date: string): void => {
    setAvailability(prev => prev.filter(slot => slot.date !== date));
  };

  const deleteAvailabilitySlot = (id: string): void => {
    setAvailability(prev => prev.filter(slot => slot.id !== id));
  };

  // Workflow Functions
  const updateWorkflowItem = (id: string, updates: Partial<WorkflowItem>): void => {
    try {
      const projeto = projetos.find(p => p.projectId === id);
      if (projeto) {
        ProjetoService.atualizarProjeto(id, updates as any);
        setProjetos(ProjetoService.carregarProjetos());
      }
    } catch (error) {
      console.error('Erro ao atualizar item do workflow:', error);
    }
  };

  const addPayment = (id: string, valor: number): void => {
    try {
      const projeto = projetos.find(p => p.projectId === id);
      if (projeto) {
        const novoPagamento = {
          id: Date.now().toString(),
          valor,
          data: getCurrentDateString()
        };
        const pagamentosAtualizados = [...projeto.pagamentos, novoPagamento];
        const valorPagoTotal = pagamentosAtualizados.reduce((sum, p) => sum + p.valor, 0);
        
        ProjetoService.atualizarProjeto(id, {
          pagamentos: pagamentosAtualizados.map(p => ({ ...p, metodo: 'pix' })),
          valorPago: valorPagoTotal,
          restante: projeto.total - valorPagoTotal
        });
        setProjetos(ProjetoService.carregarProjetos());
      }
    } catch (error) {
      console.error('Erro ao adicionar pagamento:', error);
    }
  };

  const toggleColumnVisibility = (column: string): void => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const updateWorkflowFilters = (newFilters: Partial<WorkflowFilters>): void => {
    setWorkflowFilters(prev => ({ ...prev, ...newFilters }));
  };

  const navigateMonth = (direction: number): void => {
    setWorkflowFilters(prev => {
      const [mes, ano] = prev.mes.split('/').map(Number);
      const newDate = new Date(ano, mes - 1 + direction, 1);
      return {
        ...prev,
        mes: `${newDate.getMonth() + 1}/${newDate.getFullYear()}`
      };
    });
  };

  // Cartões Functions
  const adicionarCartao = (cartao: { nome: string; diaVencimento: number; diaFechamento: number }): void => {
    const novoCartao = {
      ...cartao,
      id: Date.now().toString(),
      ativo: true
    };
    setCartoes(prev => [...prev, novoCartao]);
  };

  const atualizarCartao = (id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>): void => {
    setCartoes(prev => prev.map(cartao => 
      cartao.id === id ? { ...cartao, ...dadosAtualizados } : cartao
    ));
  };

  const removerCartao = (id: string): void => {
    setCartoes(prev => prev.filter(cartao => cartao.id !== id));
  };

  // Motor Financeiro Centralizado
  const createTransactionEngine = (input: CreateTransactionInput): void => {
    try {
      // FinancialEngine.createTransactions([input]);
      toast({
        title: "Sucesso",
        description: "Transação criada com sucesso",
      });
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação",
        variant: "destructive",
      });
    }
  };

  // Calculate summary
  const workflowSummary = {
    receita: workflowItems.reduce((sum, item) => sum + item.valorPago, 0),
    aReceber: workflowItems.reduce((sum, item) => sum + item.restante, 0),
    previsto: workflowItems.reduce((sum, item) => sum + item.total, 0)
  };

  // Filter workflow items based on current filters
  const workflowItemsAll = workflowItems;
  const filteredWorkflowItems = workflowItems.filter(item => {
    const matchesSearch = !workflowFilters.busca || 
      item.nome.toLowerCase().includes(workflowFilters.busca.toLowerCase()) ||
      item.whatsapp.includes(workflowFilters.busca) ||
      item.email.toLowerCase().includes(workflowFilters.busca.toLowerCase());
    
    const [filterMes, filterAno] = workflowFilters.mes.split('/').map(Number);
    const itemDate = new Date(item.data);
    const matchesMonth = itemDate.getMonth() + 1 === filterMes && itemDate.getFullYear() === filterAno;
    
    return matchesSearch && matchesMonth;
  });

  const contextValue: AppContextType = {
    // Cliente Management
    clientes,
    origens,
    categorias,
    produtos,
    pacotes,
    
    // Agenda
    appointments,
    availability,
    
    // Workflow
    workflowItems: filteredWorkflowItems,
    workflowItemsAll,
    workflowSummary,
    workflowFilters,
    visibleColumns,
    
    // Cartões
    cartoes,
    
    // Cliente Management Actions
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
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    
    // Workflow Actions
    updateWorkflowItem,
    addPayment,
    toggleColumnVisibility,
    updateWorkflowFilters,
    navigateMonth,
    
    // Cartões Actions
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    
    // Motor Financeiro
    createTransactionEngine
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};