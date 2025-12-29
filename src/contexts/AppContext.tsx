import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { configurationService } from '@/services/ConfigurationService';
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/financialUtils';
import { normalizeOriginToId } from '@/utils/originUtils';
import { toast } from '@/hooks/use-toast';
import { CreateTransactionInput } from '@/hooks/useFinancialTransactionsSupabase';
import { calculateTotals, calculateTotalsNew } from '@/services/FinancialCalculationEngine';
import { initializeApp, needsInitialization } from '@/utils/initializeApp';
import { useCreditCardsSupabase } from '@/hooks/useCreditCardsSupabase';
import { SupabaseCreditCardsAdapter } from '@/adapters/SupabaseCreditCardsAdapter';
import { Projeto, CriarProjetoInput } from '@/types/projeto';
import { ProjetoService } from '@/services/ProjetoService';
import { corrigirClienteIdSessoes, corrigirClienteIdAgendamentos } from '@/utils/corrigirClienteIdSessoes';
import { generateSessionId } from '@/utils/workflowSessionsAdapter';
import { syncLeadsWithClientUpdate } from '@/utils/leadClientSync';

// Types
import { Cliente, OrigemCliente } from '@/types/cliente';
import { Template } from '@/types/template';
import { Appointment, AppointmentStatus } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';

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
  valorFixo?: number;
  tabelaGlobal?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  };
  tabelaCategoria?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  };
  categoriaId?: string;
  timestampCongelamento?: string;
  // Flags para sessões históricas manuais
  isManualHistorical?: boolean;
  source?: 'manual_historical' | 'appointment' | 'budget';
  pacote?: {
    nome: string | null;
    valorBase: number;
    valorFotoExtra: number;
  };
  createdAt?: string;
}

export interface WorkflowItem {
  id: string;
  sessionId?: string;
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
  produto: string;
  qtdProduto: number;
  valorTotalProduto: number;
  produtosList?: ProdutoWorkflow[];
  valorAdicional: number;
  detalhes: string;
  total: number;
  valorPago: number;
  restante: number;
  pagamentos: Array<{id: string; valor: number; data: string}>;
  fonte: 'agenda' | 'orcamento';
  dataOriginal: Date;
  valorFinalAjustado?: boolean;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
  regrasDePrecoFotoExtraCongeladas?: RegrasPrecoFotoExtraCongeladas;
  clienteId?: string;
}

interface WorkflowFilters {
  mes: string;
  busca: string;
}

interface AppContextType {
  // CRM - Dados mantidos para compatibilidade
  templates: Template[];
  origens: OrigemCliente[];
  clientes: Cliente[];
  categorias: string[];
  produtos: any[];
  pacotes: any[];
  
  // Agenda
  appointments: Appointment[];
  // Disponibilidades da Agenda
  availability: AvailabilitySlot[];
  availabilityTypes: AvailabilityType[];
  
  // Workflow
  workflowItems: WorkflowItem[];
  workflowItemsAll: WorkflowItem[];
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
  
  // CRM Actions
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
  deleteAppointment: (id: string, preservePayments?: boolean) => void;
  // Disponibilidades Actions
  addAvailabilitySlots: (slots: AvailabilitySlot[]) => void;
  clearAvailabilityForDate: (date: string) => void;
  deleteAvailabilitySlot: (id: string) => void;
  // Tipos de Disponibilidade Actions
  addAvailabilityType: (input: { name: string; color: string }) => AvailabilityType;
  updateAvailabilityType: (id: string, updates: Partial<AvailabilityType>) => void;
  deleteAvailabilityType: (id: string) => void;
  
  // Workflow Actions
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
  
  // Cliente pré-selecionado para agendamento
  selectedClientForScheduling: string | null;
  setSelectedClientForScheduling: (clientId: string | null) => void;
  clearSelectedClientForScheduling: () => void;
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
  // Get real-time configuration data from context (single instance)
  const realtimeConfig = useConfigurationContext();
  
  const [templates, setTemplates] = useState<Template[]>(() => {
    return storage.load(STORAGE_KEYS.TEMPLATES, []);
  });
  
  const [origens, setOrigens] = useState<OrigemCliente[]>(() => {
    return storage.load(STORAGE_KEYS.ORIGINS, []);
  });
  
  // MIGRATED TO SUPABASE: Usar useClientesRealtime() para clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Use real-time data from Supabase instead of localStorage
  const categorias = realtimeConfig.categorias?.map(cat => cat.nome) || [];
  const produtos = realtimeConfig.produtos || [];
  const pacotes = realtimeConfig.pacotes || [];

  // MIGRATED TO SUPABASE: Usar useAgendaRealtime() para appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // MIGRATED TO SUPABASE: Usar useAgendaRealtime() para availability
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Tipos de Disponibilidade
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>(() => {
    const defaultTypes: AvailabilityType[] = [
      { id: 'default', name: 'Disponível', color: '#10b981' }
    ];
    return storage.load(STORAGE_KEYS.AVAILABILITY_TYPES, defaultTypes);
  });

  // Migração: Atualizar tipo "Padrão" para "Disponível"
  useEffect(() => {
    const needsMigration = availabilityTypes.some(type => 
      type.id === 'default' && type.name === 'Padrão'
    );
    
    if (needsMigration) {
      setAvailabilityTypes(prev => prev.map(type => 
        type.id === 'default' && type.name === 'Padrão'
          ? { ...type, name: 'Disponível' }
          : type
      ));
    }
  }, []);

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
    data: formatDateForStorage(projeto.dataAgendada),
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

  // Workflow State
  const [workflowFilters, setWorkflowFilters] = useState<WorkflowFilters>(() => {
    const hoje = new Date();
    return {
      mes: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`,
      busca: ''
    };
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const stored = storage.load(STORAGE_KEYS.WORKFLOW_COLUMNS, {});
    return {
      categoria: true,
      pacote: true,
      desconto: true,
      valorFotoExtra: true,
      valorAdicional: true,
      status: true,
      valorPago: true,
      restante: true,
      ...stored
    };
  });

  // ============= CARTÕES DE CRÉDITO (SUPABASE) =============
  const creditCardsHook = useCreditCardsSupabase();
  const cartoes = creditCardsHook.cartoes;

  // ============= MIGRAÇÃO DE CARTÕES (UMA VEZ - COM FLAG PERSISTENTE) =============
  const MIGRATION_FLAG = 'credit_cards_migration_v3_done';
  
  useEffect(() => {
    const checkAndMigrate = async () => {
      // Verificar flag PERSISTENTE no localStorage (sobrevive hot reload)
      if (localStorage.getItem(MIGRATION_FLAG)) return;
      
      const localCards = storage.load(STORAGE_KEYS.CARDS, []);
      if (localCards && localCards.length > 0) {
        // Marcar ANTES de iniciar para evitar re-execução
        localStorage.setItem(MIGRATION_FLAG, 'true');
        
        // Copiar e limpar localStorage PRIMEIRO
        const cardsToMigrate = [...localCards];
        storage.remove(STORAGE_KEYS.CARDS);
        
        console.log('🔄 Iniciando migração única de cartões...');
        
        for (const card of cardsToMigrate) {
          try {
            await SupabaseCreditCardsAdapter.createCard(
              card.nome,
              card.diaVencimento,
              card.diaFechamento
            );
            console.log(`✅ Cartão migrado: ${card.nome}`);
          } catch (error) {
            console.error(`❌ Erro ao migrar cartão ${card.nome}:`, error);
          }
        }
      }
    };
    
    checkAndMigrate();
  }, []); // Sem dependências - executa apenas no mount

  // Cliente pré-selecionado State
  const [selectedClientForScheduling, setSelectedClientForScheduling] = useState<string | null>(null);

  // Listener para eventos e backfill inicial - ignorar eventos internos do Workflow
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      // ✅ Só processar se não for mudança interna do Workflow
      if (e?.detail?.source !== 'workflow-internal') {
        const sessions = e?.detail?.sessions || [];
        syncSessionsToProjects(sessions);
      }
    };
    
    window.addEventListener('workflow-sessions-updated', handler);
    
    // Backfill inicial
    try {
      const existingSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      if (existingSessions.length > 0) {
        syncSessionsToProjects(existingSessions);
      }
    } catch (e) {
      console.error('❌ Erro no backfill inicial de workflow_sessions:', e);
    }
    
    return () => window.removeEventListener('workflow-sessions-updated', handler);
  }, [syncSessionsToProjects]);

  // Store workflow_sessions whenever workflowItems changes
  const prevWorkflowItemsRef = useRef<WorkflowItem[]>([]);
  useEffect(() => {
    const prev = prevWorkflowItemsRef.current;
    const current = workflowItems;
    
    // Check if workflowItems actually changed (deep comparison)
    const changed = prev.length !== current.length || 
                   prev.some((item, index) => JSON.stringify(item) !== JSON.stringify(current[index]));
    
    if (changed) {
      try {
        const serialized = current.map(item => ({
          ...item,
          dataOriginal: item.dataOriginal.toISOString()
        }));
        localStorage.setItem('workflow_sessions', JSON.stringify(serialized));
        
        window.dispatchEvent(new CustomEvent('workflow-sessions-updated', { detail: { sessions: serialized } }));
      } catch (error) {
        console.error('❌ Erro ao salvar workflow_sessions:', error);
      }
    }
    
    prevWorkflowItemsRef.current = current;
  }, [workflowItems]);

  // Update configuration when categorias/produtos/pacotes change
  useEffect(() => { 
    const stored = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const saved = stored.map((item: any) => ({ ...item }));
    localStorage.setItem('workflow_sessions', JSON.stringify(saved));
    
    window.dispatchEvent(new CustomEvent('workflow-sessions-updated', { detail: { sessions: saved } }));
    // Log removido para evitar spam no console
  }, [pacotes, produtos]);

  // Save effects
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
    storage.save(STORAGE_KEYS.WORKFLOW_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.CARDS, cartoes);
  }, [cartoes]);

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

  // Calculate workflow summary
  const workflowSummary = React.useMemo(() => {
    const filteredItems = workflowItems.filter(item => {
      // Handle ISO date format (YYYY-MM-DD) from new Projeto structure
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1; // 1-12
      const itemYear = itemDate.getFullYear();
      
      const [filterYear, filterMonth] = workflowFilters.mes.split('-').map(Number);
      
      return itemYear === filterYear && itemMonth === filterMonth;
    });

    const receita = filteredItems.reduce((sum, item) => {
      return item.status === 'entregue' ? sum + (item.valorPago || 0) : sum;
    }, 0);

    const aReceber = filteredItems.reduce((sum, item) => {
      return ['agendado', 'executando', 'producao', 'concluido'].includes(item.status) 
        ? sum + (item.restante || 0) : sum;
    }, 0);

    const previsto = filteredItems.reduce((sum, item) => sum + (item.total || 0), 0);

    return { receita, aReceber, previsto };
  }, [workflowItems, workflowFilters]);

  // Action functions
  const adicionarTemplate = (template: Omit<Template, 'id'>) => {
    const novoTemplate: Template = {
      ...template,
      id: Date.now().toString(),
    };
    setTemplates(prev => [...prev, novoTemplate]);
    return novoTemplate;
  };

  const atualizarTemplate = (id: string, template: Partial<Template>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...template } : t));
  };

  const excluirTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const definirTemplatePadrao = (id: string) => {
    setTemplates(prev => prev.map(t => ({ ...t, isPadrao: t.id === id })));
  };

  const adicionarOrigem = (origem: Omit<OrigemCliente, 'id'>) => {
    const novaOrigem: OrigemCliente = {
      ...origem,
      id: Date.now().toString(),
    };
    setOrigens(prev => [...prev, novaOrigem]);
    return novaOrigem;
  };

  const atualizarOrigem = (id: string, origem: Partial<OrigemCliente>) => {
    setOrigens(prev => prev.map(o => o.id === id ? { ...o, ...origem } : o));
  };

  const excluirOrigem = (id: string) => {
    setOrigens(prev => prev.filter(o => o.id !== id));
  };

  const adicionarCliente = (cliente: Omit<Cliente, 'id'>) => {
    const novoCliente: Cliente = {
      ...cliente,
      id: Date.now().toString(),
    };
    setClientes(prev => [...prev, novoCliente]);
    
    // Sync with leads system
    syncLeadsWithClientUpdate(novoCliente.id, novoCliente);
    
    return novoCliente;
  };

  const atualizarCliente = (id: string, dadosAtualizados: Partial<Cliente>) => {
    let clienteAtualizado: Cliente | null = null;
    
    setClientes(prev => {
      const updated = prev.map(c => {
        if (c.id === id) {
          clienteAtualizado = { ...c, ...dadosAtualizados };
          return clienteAtualizado;
        }
        return c;
      });
      return updated;
    });

    if (clienteAtualizado) {
      // Sync with other systems
      syncLeadsWithClientUpdate(id, dadosAtualizados);
      
      // Update workflow sessions that have clienteId
      try {
        const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
        let orcamentosAtualizados = 0;
        
        const sessionsAtualizadas = workflowSessions.map((session: any) => {
          if (session.clienteId === id) {
            orcamentosAtualizados++;
            return {
              ...session,
              nome: dadosAtualizados.nome || session.nome,
              whatsapp: dadosAtualizados.telefone || session.whatsapp,
              email: dadosAtualizados.email || session.email
            };
          }
          return session;
        });
        
        if (orcamentosAtualizados > 0) {
          localStorage.setItem('workflow_sessions', JSON.stringify(sessionsAtualizadas));
        }
      } catch (error) {
        console.error('❌ Erro ao atualizar workflow sessions:', error);
      }
    }
  };

  const removerCliente = (id: string) => {
    setClientes(prev => prev.filter(c => c.id !== id));
  };

  const adicionarCategoria = (categoria: string) => {
    // Use the real-time configuration system instead
    realtimeConfig.adicionarCategoria({ nome: categoria, cor: '#3b82f6' });
  };

  const removerCategoria = (categoria: string) => {
    // Find the category by name and remove it
    const categoriaObj = realtimeConfig.categorias.find(c => c.nome === categoria);
    if (categoriaObj) {
      realtimeConfig.removerCategoria(categoriaObj.id);
    }
  };

  // Agenda actions
  const addAppointment = useCallback((appointment: Omit<Appointment, 'id'>) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
    };
    
    setAppointments(prev => [...prev, newAppointment]);
    return newAppointment;
  }, []);

  const updateAppointment = useCallback((id: string, appointment: Partial<Appointment>) => {
    setAppointments(prev => {
      const updatedAppointments = prev.map(app => 
        app.id === id ? { ...app, ...appointment } : app
      );
      
      // Se o agendamento atualizado tem orçamento associado, atualizar o orçamento
      const appointmentAtualizado = updatedAppointments.find(app => app.id === id);
      if (appointmentAtualizado && (appointment.date || appointment.time)) {
        const orcamentoId = getBudgetId(appointmentAtualizado);
        if (orcamentoId && isFromBudget(appointmentAtualizado)) {
          // Sync removed - budget system disabled
        }
      }
      
      return updatedAppointments;
    });
  }, [getBudgetId, isFromBudget]);

  const deleteAppointment = useCallback((id: string, preservePayments?: boolean) => {
    const appointmentToDelete = appointments.find(app => app.id === id);
    
    if (appointmentToDelete && isFromBudget(appointmentToDelete)) {
      const budgetId = getBudgetId(appointmentToDelete);
      if (budgetId) {
        // Budget system disabled - no action needed
      }
    }
    
    setAppointments(prev => prev.filter(app => app.id !== id));
  }, [appointments, isFromBudget, getBudgetId]);

  // Availability actions
  const addAvailabilitySlots = useCallback((slots: AvailabilitySlot[]) => {
    setAvailability(prev => [...prev, ...slots]);
  }, []);

  const clearAvailabilityForDate = useCallback((date: string) => {
    setAvailability(prev => prev.filter(slot => slot.date !== date));
  }, []);

  const deleteAvailabilitySlot = useCallback((id: string) => {
    setAvailability(prev => prev.filter(slot => slot.id !== id));
  }, []);

  // Availability type actions
  const addAvailabilityType = useCallback((input: { name: string; color: string }) => {
    const newType: AvailabilityType = {
      id: Date.now().toString(),
      ...input,
    };
    setAvailabilityTypes(prev => [...prev, newType]);
    return newType;
  }, []);

  const updateAvailabilityType = useCallback((id: string, updates: Partial<AvailabilityType>) => {
    setAvailabilityTypes(prev => prev.map(type => 
      type.id === id ? { ...type, ...updates } : type
    ));
  }, []);

  const deleteAvailabilityType = useCallback((id: string) => {
    setAvailabilityTypes(prev => prev.filter(type => type.id !== id));
  }, []);

  // Workflow actions
  const updateWorkflowItem = useCallback((id: string, updates: Partial<WorkflowItem>) => {
    // Update via ProjetoService
    try {
      ProjetoService.atualizarProjeto(id, updates as any);
      setProjetos(ProjetoService.carregarProjetos());
    } catch (error) {
      console.error('❌ Erro ao atualizar item do workflow:', error);
    }
  }, []);

  const addPayment = useCallback(async (id: string, valor: number) => {
    console.log('💰 Adicionando pagamento rápido:', { id, valor });
    
    try {
      // FASE 5: Importar serviço primeiro
      const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
      
      // FASE 5: Verificar se a sessão existe antes de prosseguir
      const binding = await PaymentSupabaseService.getSessionBinding(id);
      
      if (!binding) {
        console.warn('⚠️ Sessão ainda não encontrada, pode estar sendo criada...');
        toast({
          title: "Aguarde",
          description: "A sessão ainda está sendo criada. Tente novamente em alguns segundos.",
          variant: "default"
        });
        return;
      }
      
      // 1. Gerar ID único para rastreamento
      const paymentId = `quick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 2. Salvar no Supabase COM tracking ID (usar binding.session_id diretamente)
      const success = await PaymentSupabaseService.saveSinglePaymentTracked(binding.session_id, paymentId, {
        valor,
        data: getCurrentDateString(),
        observacoes: 'Pagamento rápido',
        forma_pagamento: 'dinheiro'
      });

      if (!success) {
        console.error('❌ Falha ao salvar pagamento no Supabase');
        toast({
          title: "Erro ao adicionar pagamento",
          description: "Não foi possível salvar o pagamento. Verifique sua conexão.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Pagamento salvo no Supabase - trigger irá recalcular valor_pago automaticamente');

      // ✅ Usar session_id TEXT do binding já obtido
      const textSessionId = binding.session_id;

      // ✅ Disparar evento para forçar atualização em tempo real da tabela workflow
      window.dispatchEvent(new CustomEvent('payment-created', {
        detail: { sessionId: textSessionId, paymentId, valor }
      }));
      console.log('📢 Evento payment-created disparado para sessão (TEXT):', textSessionId);

      // 2. OPCIONAL: Atualizar localStorage SE a sessão existir lá (compatibilidade)
      try {
        const savedSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
        const sessionIndex = savedSessions.findIndex((s: any) => 
          s.id === id || s.sessionId === id || s.session_id === id
        );
        
        if (sessionIndex !== -1) {
          const session = savedSessions[sessionIndex];
          // FASE 3: Tratar valorPago que pode ser número ou string
          let currentPaid = 0;
          if (typeof session.valorPago === 'number') {
            currentPaid = session.valorPago;
          } else if (typeof session.valorPago === 'string') {
            currentPaid = parseFloat((session.valorPago || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          }
          const newPaidTotal = currentPaid + valor;

          const novoPagamento = {
            id: paymentId, // Usar o mesmo ID rastreável
            valor,
            data: getCurrentDateString(),
            forma_pagamento: 'dinheiro',
            observacoes: 'Pagamento rápido',
            tipo: 'pago' as const,
            statusPagamento: 'pago' as const,
            origem: 'workflow_rapido' as const,
            editavel: true
          };

          savedSessions[sessionIndex] = {
            ...session,
            valorPago: `R$ ${newPaidTotal.toFixed(2).replace('.', ',')}`,
            pagamentos: [...(session.pagamentos || []), novoPagamento]
          };

          const total = parseFloat((session.total || '0').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          const restante = Math.max(0, total - newPaidTotal);
          savedSessions[sessionIndex].restante = `R$ ${restante.toFixed(2).replace('.', ',')}`;

          localStorage.setItem('workflow_sessions', JSON.stringify(savedSessions));
          console.log('✅ Pagamento também atualizado no localStorage (compatibilidade)');

          // TODO: Criar transação financeira via hook useNovoFinancas
          // (precisa ser refatorado para usar o sistema Supabase)
        } else {
          console.log('ℹ️ Sessão não encontrada no localStorage (pode ser só do Supabase) - OK');
        }
      } catch (localStorageError) {
        console.warn('⚠️ Erro ao atualizar localStorage (não crítico):', localStorageError);
      }

      // 3. Exibir toast de sucesso
      toast({
        title: "Pagamento adicionado",
        description: `R$ ${valor.toFixed(2).replace('.', ',')} registrado com sucesso`,
      });

      // Nota: O realtime do Supabase irá disparar eventos automaticamente
      console.log('✅ Pagamento adicionado com sucesso:', valor, 'para sessão:', id);
    } catch (error) {
      console.error('❌ Erro ao adicionar pagamento:', error);
      toast({
        title: "Erro ao adicionar pagamento",
        description: "Ocorreu um erro ao processar o pagamento",
        variant: "destructive"
      });
    }
  }, []);

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
      const [year, month] = prev.mes.split('-').map(Number);
      const date = new Date(year, month - 1 + direction, 1);
      return {
        ...prev,
        mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      };
    });
  }, []);

  // ============= CREDIT CARD ACTIONS (SUPABASE) =============
  const adicionarCartao = useCallback((cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => {
    creditCardsHook.adicionarCartao(cartao);
  }, [creditCardsHook]);

  const atualizarCartao = useCallback((id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => {
    creditCardsHook.atualizarCartao(id, dadosAtualizados);
  }, [creditCardsHook]);

  const removerCartao = useCallback((id: string) => {
    creditCardsHook.removerCartao(id);
  }, [creditCardsHook]);

  // Financial engine action
  const createTransactionEngine = useCallback((input: CreateTransactionInput) => {
    // TODO: Migrado para hook useNovoFinancas - precisa refatorar
    console.warn('[AppContext] createTransactionEngine deprecated');
  }, []);

  // Clear selected client action
  const clearSelectedClientForScheduling = useCallback(() => {
    setSelectedClientForScheduling(null);
  }, []);

  const contextValue: AppContextType = {
    // Data
    templates,
    origens,
    clientes,
    categorias,
    produtos,
    pacotes,
    appointments,
    availability,
    availabilityTypes,
    workflowItemsAll: workflowItems,
    workflowItems: workflowItems.filter(item => {
      // Handle ISO date format (YYYY-MM-DD) from new Projeto structure
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1; // 1-12
      const itemYear = itemDate.getFullYear();
      
      const [filterYear, filterMonth] = workflowFilters.mes.split('-').map(Number);
      
      const matchesMonth = itemYear === filterYear && itemMonth === filterMonth;
      const matchesSearch = !workflowFilters.busca || 
        item.nome.toLowerCase().includes(workflowFilters.busca.toLowerCase()) ||
        item.categoria.toLowerCase().includes(workflowFilters.busca.toLowerCase()) ||
        item.pacote.toLowerCase().includes(workflowFilters.busca.toLowerCase());
      
      return matchesMonth && matchesSearch;
    }),
    workflowSummary,
    workflowFilters,
    visibleColumns,
    cartoes,
    selectedClientForScheduling,
    
    // Actions
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
    addAppointment,
    updateAppointment,
    deleteAppointment,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,
    updateWorkflowItem,
    addPayment,
    toggleColumnVisibility,
    updateWorkflowFilters,
    navigateMonth,
    isFromBudget,
    getBudgetId,
    canEditFully,
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    createTransactionEngine,
    setSelectedClientForScheduling,
    clearSelectedClientForScheduling,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};