import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/financialUtils';
import { normalizeOriginToId } from '@/utils/originUtils';
import { toast } from '@/hooks/use-toast';
import { FinancialEngine, CreateTransactionInput } from '@/services/FinancialEngine';
import { calculateTotals, calculateTotalsNew } from '@/services/FinancialCalculationEngine';
import { autoMigrateIfNeeded } from '@/utils/dataMoveMigration';
import { congelarRegrasPrecoFotoExtra, calcularComRegrasProprias, migrarRegrasParaItemAntigo, validarRegrasCongeladas } from '@/utils/precificacaoUtils';
import { migrateWorkflowClienteId } from '@/utils/migrateWorkflowClienteId';
import { initializeApp, needsInitialization } from '@/utils/initializeApp';
import { Projeto, CriarProjetoInput } from '@/types/projeto';
import { ProjetoService } from '@/services/ProjetoService';
import { corrigirClienteIdSessoes, corrigirClienteIdAgendamentos } from '@/utils/corrigirClienteIdSessoes';
import { generateSessionId } from '@/utils/workflowSessionsAdapter';
import { syncLeadsWithClientUpdate } from '@/utils/leadClientSync';
import { ReceivablesService } from '@/services/ReceivablesService';

// Types
import { Orcamento, Template, OrigemCliente, MetricasOrcamento, Cliente } from '@/types/orcamentos';
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
  // Disponibilidades da Agenda
  availability: AvailabilitySlot[];
  
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
  // Orçamentos State com migração automática
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() => {
    const orcamentosRaw = storage.load(STORAGE_KEYS.BUDGETS, []);
    const pacotesConfig = storage.load('configuracoes_pacotes', []);
    const produtosConfig = storage.load('configuracoes_produtos', []);
    
    // Executar migração automática se necessário
    let orcamentosMigrados = autoMigrateIfNeeded(orcamentosRaw, pacotesConfig, produtosConfig);
    
    // MIGRAÇÃO: Garantir que todos os orçamentos tenham valorFinal definido
    orcamentosMigrados = orcamentosMigrados.map(orc => {
      if (typeof orc.valorFinal !== 'number' || orc.valorFinal <= 0) {
        // Usar valorTotal como base, assumindo desconto zero se não tiver
        const valorFinalMigrado = (typeof orc.valorTotal === 'number' && orc.valorTotal > 0) ? orc.valorTotal : 1000;
        
        // Log removido para evitar spam no console
        
        return { ...orc, valorFinal: valorFinalMigrado };
      }
      return orc;
    });
    
    return orcamentosMigrados;
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
    perdidos: 0,
    pendentes: 0,
    taxaConversao: 0
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
    
    // Integrar com recebíveis se há valor pago (será integrado via criarProjeto com dados de agendamento)
    // A integração acontece no processamento de agendamentos confirmados
    
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

  // Listener para eventos de recebíveis (sincronização global)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { sessionId, valor } = e.detail;
      if (sessionId && valor) {
        addPayment(sessionId, valor);
      }
    };
    
    window.addEventListener('receivables:installment-paid', handler as EventListener);
    return () => window.removeEventListener('receivables:installment-paid', handler as EventListener);
  }, []);

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

  // Estado para cliente pré-selecionado para agendamento
  const [selectedClientForScheduling, setSelectedClientForSchedulingState] = useState<string | null>(null);

  const setSelectedClientForScheduling = useCallback((clientId: string | null) => {
    setSelectedClientForSchedulingState(clientId);
  }, []);

  const clearSelectedClientForScheduling = useCallback(() => {
    setSelectedClientForSchedulingState(null);
  }, []);

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

  // Função de sincronização direta com workflow (NOVA ARQUITETURA)
  const sincronizarComWorkflow = useCallback((orcamento: Orcamento) => {
    if (!orcamento || orcamento.status !== 'fechado') return;

    // Logs removidos para evitar spam no console

    // FUNÇÃO AUXILIAR: Normalizar nome do produto removendo sufixos
    const normalizarNomeProduto = (nome: string): string => {
      return nome
        .toLowerCase()
        .trim()
        .replace(/\s*\(incluso no pacote\)\s*$/i, '')
        .replace(/\s*\(incluído no pacote\)\s*$/i, '')
        .replace(/\s*\(incluso\)\s*$/i, '')
        .replace(/\s*\(incluído\)\s*$/i, '')
        .trim();
    };

    // FUNÇÃO AUXILIAR: Deduplicar produtos baseado no nome normalizado
    const deduplikarProdutosPorNome = (produtos: any[]) => {
      const produtosUnicos = new Map();
      
      produtos.forEach(produto => {
        const chaveNormalizada = normalizarNomeProduto(produto.nome);
        
        if (!produtosUnicos.has(chaveNormalizada)) {
          // Priorizar produto com nome mais limpo (sem sufixos)
          produtosUnicos.set(chaveNormalizada, produto);
        } else {
          // Se já existe, manter o que tem nome mais limpo
          const produtoExistente = produtosUnicos.get(chaveNormalizada);
          const nomeAtualLimpo = !produto.nome.includes('(incluso');
          const nomeExistenteLimpo = !produtoExistente.nome.includes('(incluso');
          
          if (nomeAtualLimpo && !nomeExistenteLimpo) {
            produtosUnicos.set(chaveNormalizada, produto);
          }
        }
      });
      
      const resultado = Array.from(produtosUnicos.values());
      
      // Logs removidos para evitar spam no console
      
      return resultado;
    };

    // FUNÇÃO AUXILIAR: Extrair produtos padronizados do orçamento (SIMPLIFICADA)
    const extrairProdutosDoOrcamento = (orcamento: any): { produtosList: any[], valorPacote: number, valorProdutosManuais: number } => {
      const produtosList: any[] = [];
      let valorPacote = 0;
      let valorProdutosManuais = 0;

      // Log removido para evitar spam no console

      // NOVA ESTRUTURA: Pacote Principal
      const pacotePrincipal = orcamento.pacotePrincipal;
      if (pacotePrincipal) {
        // Logs removidos para evitar spam no console
        
        // Adicionar produtos inclusos do pacote principal
        if (pacotePrincipal.produtosIncluidos && pacotePrincipal.produtosIncluidos.length > 0) {
          pacotePrincipal.produtosIncluidos.forEach((produto: any) => {
            produtosList.push({
              nome: produto.nome,
              quantidade: produto.quantidade,
              valorUnitario: 0, // Produtos inclusos não somam
              tipo: 'incluso'
            });
          });
        }
        
        valorPacote = pacotePrincipal.valorCongelado || 0;
      }

      // NOVA ESTRUTURA: Produtos Adicionais
      if (orcamento.produtosAdicionais && orcamento.produtosAdicionais.length > 0) {
        // Log removido para evitar spam no console
        orcamento.produtosAdicionais.forEach((produto: any) => {
          produtosList.push({
            nome: produto.nome,
            quantidade: produto.quantidade,
            valorUnitario: produto.valorUnitarioCongelado || 0,
            tipo: produto.tipo || 'manual'
          });
          
          // Somar valor dos produtos manuais
          if (produto.tipo === 'manual' || !produto.tipo) {
            valorProdutosManuais += (produto.valorUnitarioCongelado || 0) * produto.quantidade;
          }
        });
      }

      // FALLBACK: Estrutura antiga (apenas se nova estrutura não existir)
      if (!pacotePrincipal && !orcamento.produtosAdicionais && orcamento.pacotes) {
        console.log('🔄 Fallback para estrutura antiga');
        orcamento.pacotes.forEach((pacote: any) => {
          if (pacote.id && !pacote.id.startsWith('pacote-')) {
            produtosList.push({
              nome: pacote.nome,
              quantidade: pacote.quantidade || 1,
              valorUnitario: pacote.preco || 0,
              tipo: 'manual'
            });
            valorProdutosManuais += (pacote.preco || 0) * (pacote.quantidade || 1);
          }
        });
        
        valorPacote = orcamento.valorManual || orcamento.valorTotal || 0;
      }

      // Log removido para evitar spam no console
      
      // DEDUPLICAÇÃO FINAL: Aplicada como segurança
      const produtosDeduplikados = deduplikarProdutosPorNome(produtosList);
      
      return { produtosList: produtosDeduplikados, valorPacote, valorProdutosManuais };
    };

    // LÓGICA UNIFICADA: Sempre usar a função auxiliar
    const { produtosList, valorPacote, valorProdutosManuais } = extrairProdutosDoOrcamento(orcamento);
    
    // Calcular valor base dos componentes
    const valorCalculadoComponentes = valorPacote + valorProdutosManuais;
    
    // Usar valorFinal se disponível, senão usar valorTotal, senão calculado
    const valorFinalValido = typeof orcamento.valorFinal === 'number' && orcamento.valorFinal > 0;
    const valorTotalValido = typeof orcamento.valorTotal === 'number' && orcamento.valorTotal > 0;
    
    const valorTotal = valorFinalValido ? orcamento.valorFinal : 
                      valorTotalValido ? orcamento.valorTotal :
                      valorCalculadoComponentes;
    
    // Calcular se valor foi ajustado manualmente
    let valorFinalAjustado = false;
    let percentualAjusteOrcamento = 1;
    let valorOriginalOrcamento = valorCalculadoComponentes;
    
    // Transferir desconto do orçamento
    const descontoOrcamento = orcamento.desconto || 0;
    const nomePacote = orcamento.pacotePrincipal?.nome || 
                      orcamento.pacotes?.[0]?.nome?.replace(/^Pacote:\s*/, '') || 
                      '';

    const sessaoWorkflow = {
        id: `orcamento-${orcamento.id}`,
        sessionId: orcamento.sessionId || `session-orc-${orcamento.id}`,
      data: orcamento.data,
      hora: orcamento.hora,
      nome: orcamento.cliente?.nome || '',
      email: orcamento.cliente?.email || '',
      whatsapp: orcamento.cliente?.telefone || '',
      clienteId: orcamento.cliente?.id || '',
      descricao: orcamento.descricao || '',
      detalhes: orcamento.detalhes || '',
      observacoes: '',
      categoria: orcamento.categoria || '',
      pacote: nomePacote,
      valorPacote: formatCurrency(valorPacote),
      valorFotoExtra: formatCurrency(35),
      qtdFotosExtra: 0,
      valorTotalFotoExtra: formatCurrency(0),
      produto: produtosList.map(p => p.nome).join(', '),
      qtdProduto: produtosList.reduce((acc, p) => acc + p.quantidade, 0),
      valorTotalProduto: formatCurrency(valorProdutosManuais),
      valorAdicional: formatCurrency(0),
          desconto: descontoOrcamento,
      valor: formatCurrency(valorTotal),
      total: formatCurrency(valorTotal),
      valorPago: formatCurrency(0),
      restante: formatCurrency(valorTotal),
      status: '',
      pagamentos: [],
      fonte: 'orcamento',
      dataOriginal: parseDateFromStorage(orcamento.data),
      produtosList: produtosList,
      // Campos de ajuste de valor
      valorFinalAjustado,
      valorOriginalOrcamento,
      percentualAjusteOrcamento
    };

    // Log removido para evitar spam no console

    // SALVAR COM PREVENÇÃO DE DUPLICAÇÃO
    const saved = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    // Verificar duplicação por sessionId E por id
    const sessionId = sessaoWorkflow.sessionId;
    const existingBySessionId = saved.findIndex((s: any) => s.sessionId === sessionId);
    const existingById = saved.findIndex((s: any) => s.id === sessaoWorkflow.id);
    
    if (existingBySessionId >= 0) {
      console.log(`🔄 Atualizando sessão existente (sessionId): ${sessionId}`);
      saved[existingBySessionId] = { ...saved[existingBySessionId], ...sessaoWorkflow };
    } else if (existingById >= 0) {
      console.log(`🔄 Atualizando sessão existente (id): ${sessaoWorkflow.id}`);
      saved[existingById] = { ...saved[existingById], ...sessaoWorkflow };
    } else {
      console.log(`➕ Criando nova sessão: ${sessionId}`);
      saved.push(sessaoWorkflow);
    }
    
    
    localStorage.setItem('workflow_sessions', JSON.stringify(saved));
    // Notificar listeners (Dashboard/Projetos)
    window.dispatchEvent(new CustomEvent('workflow-sessions-updated', { detail: { sessions: saved } }));
    // Log removido para evitar spam no console
  }, [pacotes, produtos]);

  // Save effects
  useEffect(() => {
    storage.save(STORAGE_KEYS.BUDGETS, orcamentos);
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
    const serialized = serializeAppointments(appointments);
    storage.save(STORAGE_KEYS.APPOINTMENTS, serialized);
  }, [appointments]);

  // Salvar disponibilidades da agenda
  useEffect(() => {
    storage.save(STORAGE_KEYS.AVAILABILITY, availability);
  }, [availability]);

  // Limpeza automática: remover disponibilidades que conflitam com agendamentos
  useEffect(() => {
    setAvailability(prev => {
      const appointmentKeys = new Set(
        appointments.map(a => `${formatDateForStorage(a.date)}|${a.time}`)
      );
      const cleaned = prev.filter(s => !appointmentKeys.has(`${s.date}|${s.time}`));
      return cleaned;
    });
  }, [appointments]);

  // Salvar projetos com debounce para evitar loops
  const projetosStringified = JSON.stringify(projetos);
  useEffect(() => {
    const timer = setTimeout(() => {
      ProjetoService.salvarProjetos(projetos);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [projetosStringified]); // Usar string para comparação profunda

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

  // Executar migração de clienteId uma única vez
  useEffect(() => {
    migrateWorkflowClienteId();
  }, []);

  // ✅ OTIMIZADO: Sync configuration data com debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const syncConfigData = () => {
      const configCategorias = storage.load('configuracoes_categorias', []);
      const configProdutos = storage.load('configuracoes_produtos', []);
      const configPacotes = storage.load('configuracoes_pacotes', []);
      
      // Transform categorias from objects to string array
      const categoriasNomes = configCategorias.map((cat: any) => cat.nome || cat);
      
      // ✅ OTIMIZADO: Só atualizar se dados realmente mudaram
      setCategorias(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(categoriasNomes)) {
          return categoriasNomes;
        }
        return prev;
      });
      
      setProdutos(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(configProdutos)) {
          return configProdutos;
        }
        return prev;
      });
      
      setPacotes(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(configPacotes)) {
          return configPacotes;
        }
        return prev;
      });
    };

    // ✅ OTIMIZADO: Debounce para evitar múltiplas execuções
    const debouncedSyncConfigData = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(syncConfigData, 100);
    };

    // Executar na inicialização
    syncConfigData();
    
    // Escutar eventos de mudança com debounce
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('configuracoes_')) {
        debouncedSyncConfigData();
      }
    };
    
    // Também adicionar listener personalizado para mudanças locais
    const handleCustomUpdate = () => {
      debouncedSyncConfigData();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('configuracoes-updated', handleCustomUpdate);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('configuracoes-updated', handleCustomUpdate);
    };
  }, []); // Dependências vazias com listeners otimizados

  // Calculate metrics
  useEffect(() => {
    const hoje = getCurrentDateString();
    const [anoAtual, mesAtual] = hoje.split('-').map(Number);

    const orcamentosMes = orcamentos.filter(orc => {
      const [anoOrc, mesOrc] = orc.criadoEm.split('-').map(Number);
      return mesOrc === mesAtual && anoOrc === anoAtual;
    });

    const enviados = orcamentosMes.filter(o => o.status === 'enviado').length;
    const fechados = orcamentosMes.filter(o => o.status === 'fechado').length;
    const perdidos = orcamentosMes.filter(o => o.status === 'perdido').length;
    const pendentes = orcamentosMes.filter(o => o.status === 'pendente').length;

    setMetricas({
      totalMes: orcamentosMes.length,
      enviados,
      fechados,
      perdidos,
      pendentes,
      taxaConversao: enviados > 0 ? (fechados / enviados) * 100 : 0
    });
  }, [orcamentos]);

  // ===================================================================
  // SINCRONIZAÇÃO REFATORADA: REMOVIDA PARA EVITAR LOOP INFINITO
  // A sincronização agora é feita explicitamente dentro das funções de atualização
  // ===================================================================

  // ===================================================================
  // EXECUÇÃO DOS SYNCS: REMOVIDOS PARA EVITAR LOOP INFINITO
  // A sincronização agora é feita explicitamente dentro das funções de atualização
  // ===================================================================

  // Process confirmed appointments to workflow
  const processConfirmedAppointmentsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const confirmedAppointments = appointments.filter(app => app.status === 'confirmado');
    
    const newItems: WorkflowItem[] = [];
    const processedIds = new Set<string>();
    
    confirmedAppointments.forEach(appointment => {
      const appointmentKey = `agenda-${appointment.id}`;
      
      // Evitar processamento duplicado
      if (processConfirmedAppointmentsRef.current.has(appointmentKey)) {
        return;
      }
      
      const existingItem = workflowItems.find(item => 
        item.id === appointmentKey && item.fonte === 'agenda'
      );
      
      if (!existingItem) {
        // Buscar dados do pacote selecionado
        let pacoteData = null;
        let categoriaName = '';
        let valorFotoExtraFromPackage = 35;
        
        if (appointment.packageId) {
          pacoteData = pacotes.find(p => p.id === appointment.packageId);
          if (pacoteData) {
            if (pacoteData.categoria_id) {
              const configCategorias = storage.load('configuracoes_categorias', []);
              const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
              categoriaName = categoria ? categoria.nome : String(pacoteData.categoria_id);
            } else {
              categoriaName = pacoteData.categoria || '';
            }
            valorFotoExtraFromPackage = pacoteData.valor_foto_extra || pacoteData.valorFotoExtra || 35;
          }
        }
        
        if (!pacoteData) {
          categoriaName = appointment.type.includes('Gestante') ? 'Gestante' : 
                        appointment.type.includes('Família') ? 'Família' : 
                        appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros';
        }

        // CONGELAR REGRAS APENAS UMA VEZ
        const regrasCongeladas = congelarRegrasPrecoFotoExtra({
          valorFotoExtra: valorFotoExtraFromPackage,
          categoria: categoriaName,
          categoriaId: pacoteData?.categoria_id
        });

        const clienteId = clientes.find(c => 
          c.nome.toLowerCase().trim() === appointment.client.toLowerCase().trim()
        )?.id;

        const newWorkflowItem: WorkflowItem = {
          id: appointmentKey,
          sessionId: `session-agenda-${appointment.id}`,
          data: formatDateForStorage(appointment.date),
          hora: appointment.time,
          nome: appointment.client,
          whatsapp: (appointment as any).clientPhone || appointment.whatsapp || "+55 (11) 99999-9999",
          email: (appointment as any).clientEmail || appointment.email || "",
          descricao: appointment.description || '',
          status: "",
          categoria: categoriaName,
          clienteId: clienteId,
          pacote: pacoteData ? pacoteData.nome : (
            appointment.type.includes('Gestante') ? 'Completo' : 
            appointment.type.includes('Família') ? 'Básico' : 
            appointment.type.includes('Corporativo') ? 'Empresarial' : 'Básico'
          ),
          valorPacote: pacoteData ? (pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || 0) : (
            appointment.type.includes('Gestante') ? 980 :
            appointment.type.includes('Família') ? 650 :
            appointment.type.includes('Corporativo') ? 890 : 650
          ),
          desconto: 0,
          valorFotoExtra: valorFotoExtraFromPackage,
          qtdFotoExtra: 0,
          valorTotalFotoExtra: 0,
          produto: "",
          qtdProduto: 0,
          valorTotalProduto: 0,
          valorAdicional: 0,
          detalhes: appointment.description || "",
          total: 0,
          valorPago: appointment.paidAmount || 0,
          restante: 0,
          pagamentos: appointment.paidAmount ? [{
            id: 'initial',
            valor: appointment.paidAmount,
            data: getCurrentDateString()
          }] : [],
          fonte: 'agenda',
          dataOriginal: appointment.date,
          regrasDePrecoFotoExtraCongeladas: regrasCongeladas
        };

        // Adicionar produtos incluídos
        let allProductsFromAppointment: ProdutoWorkflow[] = [];
        
        if (appointment.produtosIncluidos && appointment.produtosIncluidos.length > 0) {
          allProductsFromAppointment = appointment.produtosIncluidos.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: 0,
            tipo: 'incluso' as const
          }));
        }
        else if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
          allProductsFromAppointment = pacoteData.produtosIncluidos.map(produtoIncluido => {
            const produtoData = produtos.find(p => p.id === produtoIncluido.produtoId);
            return {
              nome: produtoData?.nome || 'Produto não encontrado',
              quantidade: produtoIncluido.quantidade || 1,
              valorUnitario: 0,
              tipo: 'incluso' as const
            };
          });
        }

        newWorkflowItem.produtosList = allProductsFromAppointment;

        if (allProductsFromAppointment.length > 0) {
          const primeiroProduto = allProductsFromAppointment[0];
          newWorkflowItem.produto = `${primeiroProduto.nome} (incluso no pacote)`;
          newWorkflowItem.qtdProduto = primeiroProduto.quantidade;
          newWorkflowItem.valorTotalProduto = primeiroProduto.valorUnitario * primeiroProduto.quantidade;
        }

        newWorkflowItem.total = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                               newWorkflowItem.valorTotalProduto + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
        newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

        newItems.push(newWorkflowItem);
        processedIds.add(appointmentKey);
      }
    });

    // Criar projetos apenas se há novos items e evitar loops
    if (newItems.length > 0) {
      // Marcar como processados antes de criar projetos
      processedIds.forEach(id => processConfirmedAppointmentsRef.current.add(id));
      
      // Usar setTimeout para quebrar o loop de dependências
      setTimeout(() => {
        newItems.forEach(item => {
          const novoProjeto = criarProjeto({
            clienteId: item.clienteId || '',
            nome: item.nome,
            categoria: item.categoria,
            pacote: item.pacote,
            descricao: item.descricao,
            detalhes: item.detalhes,
            whatsapp: item.whatsapp,
            email: item.email,
            dataAgendada: item.dataOriginal || new Date(item.data),
            horaAgendada: item.hora,
            valorPacote: item.valorPacote,
            fonte: 'agenda',
            agendamentoId: item.id
          });
          
          // Integrar entrada de agendamento com recebíveis
          if (item.valorPago > 0 && item.clienteId) {
            setTimeout(() => {
              ReceivablesService.addEntradaPago(
                novoProjeto.projectId,
                item.clienteId!,
                item.valorPago,
                getCurrentDateString()
              );
            }, 100);
          }
        });
      }, 0);
    }
  }, [appointments.length, workflowItems.length]); // Dependências simplificadas

  // Process closed budgets to workflow  
  const processClosedBudgetsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const orcamentosFechados = orcamentos.filter(orc => orc.status === 'fechado');
    
    const newItems: WorkflowItem[] = [];
    const processedIds = new Set<string>();
    
    orcamentosFechados.forEach(orc => {
      const budgetKey = `orcamento-${orc.id}`;
      
      // Evitar processamento duplicado
      if (processClosedBudgetsRef.current.has(budgetKey)) {
        return;
      }
      
      const existingItem = workflowItems.find(item => 
        item.id === budgetKey && item.fonte === 'orcamento'
      );
      
      if (existingItem) {
        existingItem.descricao = orc.descricao || '';
        return;
      }
      
      // Buscar dados do pacote do orçamento
      let pacoteData = null;
      let categoriaName = orc.categoria;
      let valorFotoExtraFromPackage = 35;
      let valorPacoteFromBudget = 0;
      
      if (orc.pacotes && orc.pacotes.length > 0) {
        const pacoteOrcamento = orc.pacotes[0];
        let pacoteId = pacoteOrcamento.id;
        
        // Busca inteligente do pacote com múltiplos fallbacks
        pacoteData = pacotes.find(p => p.id === pacoteId);
        
        if (!pacoteData && pacoteId) {
          const idLimpo = pacoteId.replace(/^pacote-/, '');
          pacoteData = pacotes.find(p => p.id === idLimpo);
        }
        
        if (!pacoteData && pacoteOrcamento.nome) {
          pacoteData = pacotes.find(p => p.nome === pacoteOrcamento.nome);
        }
        
        if (!pacoteData) {
          pacoteData = {
            id: pacoteOrcamento.id,
            nome: pacoteOrcamento.nome,
            valor: pacoteOrcamento.preco || 0,
            valor_base: pacoteOrcamento.preco || 0,
            valorVenda: pacoteOrcamento.preco || 0
          };
        }
        
        if (pacoteData) {
          if (pacoteData.categoria_id) {
            const configCategorias = storage.load('configuracoes_categorias', []);
            const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
            categoriaName = categoria ? categoria.nome : String(pacoteData.categoria_id);
          } else {
            categoriaName = pacoteData.categoria || orc.categoria;
          }
          valorFotoExtraFromPackage = pacoteData.valor_foto_extra || pacoteData.valorFotoExtra || 35;
          valorPacoteFromBudget = pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || 0;
        } else {
          valorPacoteFromBudget = pacoteOrcamento.preco || 0;
        }
      }

      // CONGELAR REGRAS APENAS UMA VEZ
      const regrasCongeladas = congelarRegrasPrecoFotoExtra({
        valorFotoExtra: valorFotoExtraFromPackage,
        categoria: categoriaName,
        categoriaId: pacoteData?.categoria_id
      });

      const newWorkflowItem: WorkflowItem = {
        id: `orcamento-${orc.id}`,
        sessionId: `session-orc-${orc.id}`,
        data: orc.data,
        hora: orc.hora,
        nome: orc.cliente.nome,
        whatsapp: orc.cliente.telefone,
        email: orc.cliente.email,
        descricao: orc.descricao || '',
        status: 'Fechado',
        categoria: categoriaName,
        clienteId: orc.cliente.id, // CORREÇÃO: Usar clienteId do orçamento
        pacote: pacoteData ? pacoteData.nome : (orc.pacotes[0]?.nome || ''),
        valorPacote: valorPacoteFromBudget,
        desconto: 0,
        valorFotoExtra: valorFotoExtraFromPackage,
        qtdFotoExtra: 0,
        valorTotalFotoExtra: 0,
        produto: '',
        qtdProduto: 0,
        valorTotalProduto: 0,
        valorAdicional: 0,
        detalhes: orc.detalhes,
        total: 0,
        valorPago: 0,
        restante: 0,
        pagamentos: [],
        fonte: 'orcamento',
        dataOriginal: parseDateFromStorage(orc.data),
        // NOVO: Adicionar regras congeladas
        regrasDePrecoFotoExtraCongeladas: regrasCongeladas
      };

      // CORREÇÃO: Transferir TODOS os produtos do orçamento
      let todosProdutosDoOrcamento: ProdutoWorkflow[] = [];
      
      // 1. Produtos incluídos no pacote principal
      if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
        const produtosInclusos = pacoteData.produtosIncluidos.map(produtoIncluido => {
          const produtoData = produtos.find(p => p.id === produtoIncluido.produtoId);
          if (produtoData) {
            return {
              nome: produtoData.nome,
              quantidade: produtoIncluido.quantidade || 1,
              valorUnitario: 0, // Produtos inclusos têm valor 0 na nova lógica
              tipo: 'incluso' as const
            };
          }
          return null;
        }).filter(Boolean) as ProdutoWorkflow[];
        todosProdutosDoOrcamento.push(...produtosInclusos);
      }

      // 2. Produtos adicionais manuais do orçamento (não inclusos no pacote)
      if (orc.pacotes && orc.pacotes.length > 1) {
        const produtosManuais = orc.pacotes.slice(1).map(item => ({
          nome: item.nome,
          quantidade: item.quantidade || 1,
          valorUnitario: item.preco || 0,
          tipo: 'manual' as const
        }));
        todosProdutosDoOrcamento.push(...produtosManuais);
      }

      // Adicionar lista completa de produtos
      newWorkflowItem.produtosList = todosProdutosDoOrcamento;

      // Para compatibilidade, usar o primeiro produto no campo principal
      if (todosProdutosDoOrcamento.length > 0) {
        const primeiroProduto = todosProdutosDoOrcamento[0];
        newWorkflowItem.produto = primeiroProduto.nome;
        newWorkflowItem.qtdProduto = primeiroProduto.quantidade;
        newWorkflowItem.valorTotalProduto = primeiroProduto.valorUnitario * primeiroProduto.quantidade;
      }

        // NOVA LÓGICA: Priorizar valorFinal ajustado manualmente, senão calcular
        const valorProdutosManuaisOrc = todosProdutosDoOrcamento
          ?.filter(p => p.tipo === 'manual')
          ?.reduce((total, p) => total + (p.valorUnitario * p.quantidade), 0) || 0;
        
        // Calcular valor baseado nos componentes
        const valorCalculado = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                              valorProdutosManuaisOrc + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
        
        // Transferir desconto do orçamento se existir
        if (orc.desconto && orc.desconto > 0) {
          newWorkflowItem.desconto = orc.desconto;
          console.log('🔧 Transferindo desconto do orçamento:', {
            orcamentoId: orc.id,
            desconto: orc.desconto,
            valorCalculado,
            valorFinalOrcamento: orc.valorFinal
          });
        }
        
        // Calcular total final com desconto
        newWorkflowItem.total = valorCalculado - (newWorkflowItem.desconto || 0);
        newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

      newItems.push(newWorkflowItem);
    });

    // NOVA ARQUITETURA: Criar projetos para orçamentos fechados
    newItems.forEach(item => {
      criarProjeto({
        clienteId: item.clienteId || '',
        nome: item.nome,
        categoria: item.categoria,
        pacote: item.pacote,
        descricao: item.descricao,
        detalhes: item.detalhes,
        whatsapp: item.whatsapp,
        email: item.email,
        dataAgendada: item.dataOriginal || new Date(item.data),
        horaAgendada: item.hora,
        valorPacote: item.valorPacote,
        fonte: 'orcamento',
        orcamentoId: item.id
      });
    });
  }, [orcamentos, workflowItems, pacotes, produtos]);

  // Calculate workflow summary
  const workflowSummary = React.useMemo(() => {
    const filteredItems = workflowItems.filter(item => {
      // Handle ISO date format (YYYY-MM-DD) from new Projeto structure
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1; // 1-12
      const itemYear = itemDate.getFullYear();
      
      const [filterMonth, filterYear] = workflowFilters.mes.split('/');
      const monthMatches = itemMonth === parseInt(filterMonth) && itemYear === parseInt(filterYear);

      const searchMatches = !workflowFilters.busca || 
        item.nome.toLowerCase().includes(workflowFilters.busca.toLowerCase());

      return monthMatches && searchMatches;
    });

    const receita = filteredItems.reduce((sum, item) => sum + item.valorPago, 0);
    const aReceber = filteredItems.reduce((sum, item) => sum + item.restante, 0);
    const previsto = filteredItems.reduce((sum, item) => sum + item.total, 0);

    return { receita, aReceber, previsto };
  }, [workflowItems, workflowFilters]);

  // Action functions
  const adicionarOrcamento = (orcamento: Omit<Orcamento, 'id' | 'criadoEm'>) => {
    const novoOrcamento: Orcamento = {
      ...orcamento,
      id: Date.now().toString(),
      criadoEm: getCurrentDateString(),
    };
    setOrcamentos(prev => [...prev, novoOrcamento]);
    
    // SINCRONIZAÇÃO AUTOMÁTICA: Se orçamento é criado como fechado, sincronizar imediatamente
    if (novoOrcamento.status === 'fechado') {
      setTimeout(() => {
        sincronizarComWorkflow(novoOrcamento);
      }, 100);
    }
    
    return novoOrcamento;
  };

  const atualizarOrcamento = (id: string, orcamento: Partial<Orcamento>) => {
    setOrcamentos(prev => {
      const orcamentoAnterior = prev.find(o => o.id === id);
      const updatedOrcamentos = prev.map(o => o.id === id ? { ...o, ...orcamento } : o);
      
      // SINCRONIZAÇÃO EXPLÍCITA: Orçamento → Agenda
      const orcamentoAtualizado = updatedOrcamentos.find(o => o.id === id);
      if (orcamentoAtualizado && orcamentoAnterior) {
        const statusAnterior = orcamentoAnterior.status;
        const statusAtual = orcamentoAtualizado.status;
        
        // Detectar mudanças de status que afetam agendamentos
        const mudouDeFechado = statusAnterior === 'fechado' && statusAtual !== 'fechado';
        const mudouParaFechado = statusAnterior !== 'fechado' && statusAtual === 'fechado';
        const mudouParaPerdido = statusAtual === 'perdido';
        
        setAppointments(prevAppointments => {
          const agendamentoAssociado = prevAppointments.find(app => 
            app.id === `orcamento-${id}` || (app as any).orcamentoId === id
          );
          
          if (mudouDeFechado && agendamentoAssociado) {
            // Orçamento mudou de "fechado" para outro status
            // REGRA UNIVERSAL DE REMOÇÃO: 
            // Orçamento mudou de "fechado" para QUALQUER outro status → SEMPRE REMOVER agendamento
            // Isso permite que o orçamento com novo status seja exibido pelo useUnifiedCalendar
            return prevAppointments.filter(app => app.id !== agendamentoAssociado.id);
          } else if (mudouParaFechado && !agendamentoAssociado) {
            // CORREÇÃO: CRIAR AGENDAMENTO quando orçamento mudou para "fechado"
            // Buscar dados do pacote para incluir produtos
            console.log('=== CRIANDO AGENDAMENTO DE ORÇAMENTO FECHADO ===');
            console.log('DEBUG: Dados do orçamento para agendamento:', {
              orcamento: orcamentoAtualizado,
              pacotes: orcamentoAtualizado.pacotes,
              pacoteId: orcamentoAtualizado.pacotes?.[0]?.id,
              descricao: orcamentoAtualizado.descricao,
              detalhes: orcamentoAtualizado.detalhes
            });

            let produtosIncluidos: any[] = [];
            
            if (orcamentoAtualizado.pacotes && orcamentoAtualizado.pacotes.length > 0) {
              const pacoteOrcamento = orcamentoAtualizado.pacotes[0];
              const pacoteData = pacotes.find(p => p.id === pacoteOrcamento.id || p.nome === pacoteOrcamento.nome);
              
              if (pacoteData && pacoteData.produtosIncluidos) {
                produtosIncluidos = pacoteData.produtosIncluidos.map(produtoIncluido => {
                  const produtoData = produtos.find(p => p.id === produtoIncluido.produtoId);
                  return {
                    id: produtoIncluido.produtoId,
                    nome: produtoData?.nome || 'Produto não encontrado',
                    quantidade: produtoIncluido.quantidade || 1,
                    valorUnitario: produtoData?.valorVenda || produtoData?.preco_venda || 0,
                    tipo: 'incluso'
                  };
                }).filter(Boolean);
              }
            }

            // CORREÇÃO: Garantir packageId válido com fallback
            let packageId = orcamentoAtualizado.pacotes?.[0]?.id;
            if (!packageId && orcamentoAtualizado.pacotes?.[0]?.nome) {
              // Fallback: buscar pacote por nome nas configurações
              const pacoteEncontrado = pacotes.find(p => p.nome === orcamentoAtualizado.pacotes[0].nome);
              packageId = pacoteEncontrado?.id;
              console.log('DEBUG: Fallback packageId por nome:', { nome: orcamentoAtualizado.pacotes[0].nome, encontrado: packageId });
            }
            
            const novoAgendamento: Appointment = {
              id: `orcamento-${id}`,
              title: `${orcamentoAtualizado.categoria || 'Sessão'} - ${orcamentoAtualizado.cliente.nome}`,
              date: parseDateFromStorage(orcamentoAtualizado.data),
              time: orcamentoAtualizado.hora,
              type: orcamentoAtualizado.categoria || 'Sessão',
              client: orcamentoAtualizado.cliente.nome,
              status: 'confirmado' as AppointmentStatus,
              description: orcamentoAtualizado.descricao, // CORREÇÃO: usar descricao em vez de detalhes
              packageId: packageId,
              produtosIncluidos: produtosIncluidos,
              email: orcamentoAtualizado.cliente.email,
              whatsapp: orcamentoAtualizado.cliente.telefone,
              orcamentoId: id,
              origem: 'orcamento'
            };

            console.log('DEBUG: Agendamento criado:', novoAgendamento);
            
            // NOVA: Sincronizar diretamente com workflow usando dados do orçamento
            setTimeout(() => {
              sincronizarComWorkflow(orcamentoAtualizado);
            }, 100);
            
            return [...prevAppointments, novoAgendamento];
          } else if (agendamentoAssociado && statusAtual === 'fechado') {
            // Atualizar data e hora do agendamento se mudaram no orçamento fechado
            if (orcamento.data || orcamento.hora) {
              return prevAppointments.map(app => {
                if (app.id === agendamentoAssociado.id) {
                  const updates: Partial<Appointment> = {};
                  if (orcamento.data) {
                    updates.date = parseDateFromStorage(orcamento.data);
                  }
                  if (orcamento.hora) {
                    updates.time = orcamento.hora;
                  }
                  return { ...app, ...updates };
                }
                return app;
              });
            }
          }
          return prevAppointments;
        });
        
        // Remover projeto quando orçamento não está mais fechado
        if (mudouDeFechado) {
          const projeto = projetos.find(p => p.orcamentoId === `orcamento-${id}`);
          if (projeto) {
            excluirProjeto(projeto.projectId);
          }
        }

        // Atualizar Projetos e workflow_sessions quando orçamento fechado muda data/hora
        if (orcamentoAtualizado && orcamentoAtualizado.status === 'fechado' && (orcamento.data || orcamento.hora)) {
          try {
            const budgetKey = `orcamento-${id}`;

            // Atualizar projetos vinculados ao orçamento
            const projetosVinculados = projetos.filter(p => p.orcamentoId === budgetKey);
            projetosVinculados.forEach(p => {
              atualizarProjeto(p.projectId, {
                dataAgendada: parseDateFromStorage(orcamentoAtualizado.data),
                horaAgendada: orcamentoAtualizado.hora
              });
            });

            // Atualizar workflow_sessions
            const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
            const matchIds = new Set([budgetKey, generateSessionId(budgetKey)]);
            const updatedSessions = sessions.map((s: any) => {
              if (matchIds.has(s.id) || matchIds.has(s.sessionId)) {
                return { ...s, data: orcamentoAtualizado.data, hora: orcamentoAtualizado.hora };
              }
              return s;
            });
            localStorage.setItem('workflow_sessions', JSON.stringify(updatedSessions));
            // Notificar listeners para sincronização com Projetos
            window.dispatchEvent(new CustomEvent('workflow-sessions-updated', { detail: { sessions: updatedSessions } }));
          } catch (e) {
            console.error('❌ Erro ao sincronizar orçamento com projetos e workflow_sessions:', e);
          }
        }
      }
      
      return updatedOrcamentos;
    });
  };

  const excluirOrcamento = (id: string) => {
    setOrcamentos(prev => prev.filter(o => o.id !== id));
  };

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
    console.log('🔥 [CRM] Iniciando criação de cliente:', cliente);
    
    // Normalize origin to ensure consistent ID storage
    const normalizedOrigin = normalizeOriginToId(cliente.origem);
    console.log('🔄 [CRM] Origem normalizada:', { original: cliente.origem, normalizada: normalizedOrigin });
    
    const novoCliente: Cliente = {
      ...cliente,
      id: Date.now().toString(),
      origem: normalizedOrigin
    };
    
    console.log('✅ [CRM] Cliente criado:', { id: novoCliente.id, nome: novoCliente.nome, origem: novoCliente.origem });
    
    setClientes(prev => {
      const updatedClients = [...prev, novoCliente];
      console.log('💾 [CRM] Total de clientes após adição:', updatedClients.length);
      return updatedClients;
    });
    
    return novoCliente;
  };

  // Função para sincronizar nome do cliente com workflow_sessions
  const sincronizarNomeClienteComWorkflow = (clienteId: string, novoNome: string) => {
    try {
      const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      let sessionsAtualizadas = 0;
      
      const sessionsCorrigidas = sessions.map((session: any) => {
        if (session.clienteId === clienteId && session.nome !== novoNome) {
          sessionsAtualizadas++;
          return { ...session, nome: novoNome };
        }
        return session;
      });
      
      if (sessionsAtualizadas > 0) {
        localStorage.setItem('workflow_sessions', JSON.stringify(sessionsCorrigidas));
        // Notificar listeners
        window.dispatchEvent(new CustomEvent('workflow-sessions-updated', { detail: { sessions: sessionsCorrigidas } }));
        console.log(`✅ ${sessionsAtualizadas} sessões do workflow atualizadas com novo nome: ${novoNome}`);
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar nome no workflow:', error);
    }
  };

  // Função para sincronizar nome do cliente com orçamentos
  const sincronizarNomeClienteComOrcamentos = (clienteId: string, novoNome: string) => {
    try {
      const orcamentos = JSON.parse(localStorage.getItem('budget_data') || '[]');
      let orcamentosAtualizados = 0;
      
      const orcamentosCorrigidos = orcamentos.map((orc: any) => {
        if (orc.cliente?.id === clienteId && orc.cliente?.nome !== novoNome) {
          orcamentosAtualizados++;
          return {
            ...orc,
            cliente: { ...orc.cliente, nome: novoNome }
          };
        }
        return orc;
      });
      
      if (orcamentosAtualizados > 0) {
        localStorage.setItem('budget_data', JSON.stringify(orcamentosCorrigidos));
        console.log(`✅ ${orcamentosAtualizados} orçamentos atualizados com novo nome: ${novoNome}`);
        
        // Atualizar estado dos orçamentos também
        setOrcamentos(orcamentosCorrigidos);
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar nome nos orçamentos:', error);
    }
  };

  // Função para sincronizar nome do cliente com agendamentos
  const sincronizarNomeClienteComAgendamentos = (clienteId: string, novoNome: string) => {
    try {
      const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
      let appointmentsAtualizados = 0;
      
      const appointmentsCorrigidos = appointments.map((app: any) => {
        if (app.clienteId === clienteId && app.client !== novoNome) {
          appointmentsAtualizados++;
          return { ...app, client: novoNome };
        }
        return app;
      });
      
      if (appointmentsAtualizados > 0) {
        localStorage.setItem('appointments', JSON.stringify(appointmentsCorrigidos));
        console.log(`✅ ${appointmentsAtualizados} agendamentos atualizados com novo nome: ${novoNome}`);
        
        // Atualizar estado dos appointments também
        setAppointments(appointmentsCorrigidos);
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar nome nos agendamentos:', error);
    }
  };

  const atualizarCliente = (id: string, dadosAtualizados: Partial<Cliente>) => {
    setClientes(prev => prev.map(cliente => 
      cliente.id === id ? { ...cliente, ...dadosAtualizados } : cliente
    ));
    
    // SINCRONIZAÇÃO AUTOMÁTICA: Quando o nome for alterado, propagar para todos os sistemas
    if (dadosAtualizados.nome) {
      sincronizarNomeClienteComWorkflow(id, dadosAtualizados.nome);
      sincronizarNomeClienteComOrcamentos(id, dadosAtualizados.nome);
      sincronizarNomeClienteComAgendamentos(id, dadosAtualizados.nome);
    }
    
    // Sincronizar com leads
    syncLeadsWithClientUpdate(id, dadosAtualizados);
    
    // Dispatch global client update event
    window.dispatchEvent(new CustomEvent('clients:updated', {
      detail: { clienteId: id, updates: dadosAtualizados }
    }));
  };

  const removerCliente = (id: string) => {
    setClientes(prev => prev.filter(cliente => cliente.id !== id));
    
    // Limpar recebíveis do cliente
    ReceivablesService.removeByClienteId(id);
  };

  const adicionarCategoria = (categoria: string) => {
    if (!categorias.includes(categoria)) {
      setCategorias(prev => [...prev, categoria]);
    }
  };

  const removerCategoria = (categoria: string) => {
    setCategorias(prev => prev.filter(c => c !== categoria));
  };

  const addAppointment = (appointment: Omit<Appointment, 'id'>) => {
    // Validação de conflitos para agendamentos confirmados
    if (appointment.status === 'confirmado') {
      const existingConfirmed = appointments.find(app => 
        app.date instanceof Date ? 
          (app.date.toDateString() === (appointment.date instanceof Date ? appointment.date : new Date(appointment.date)).toDateString() && app.time === appointment.time && app.status === 'confirmado') :
          (new Date(app.date).toDateString() === (appointment.date instanceof Date ? appointment.date : new Date(appointment.date)).toDateString() && app.time === appointment.time && app.status === 'confirmado')
      );
      
      if (existingConfirmed) {
        throw new Error('Já existe um agendamento confirmado neste horário');
      }
    }

    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
      clienteId: appointment.clienteId, // Preservar clienteId
    };
    
    // Inserir appointment em ordem cronológica crescente
    setAppointments(prev => {
      const updatedAppointments = [...prev, newAppointment];
      
      // Ordenar por data + hora cronologicamente (mais antigo primeiro)
      updatedAppointments.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        
        // Combinar data + hora para comparação cronológica completa
        const timeA = dateA.getTime() + (a.time ? parseTimeToMinutes(a.time) * 60000 : 0);
        const timeB = dateB.getTime() + (b.time ? parseTimeToMinutes(b.time) * 60000 : 0);
        
        return timeA - timeB;
      });
      
      return updatedAppointments;
    });
    
    return newAppointment;
  };

  // Função auxiliar para converter hora HH:MM em minutos
  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const updateAppointment = (id: string, appointment: Partial<Appointment>) => {
    setAppointments(prev => {
      const updatedAppointments = prev.map(app => {
        if (app.id === id) {
          const updated = { ...app, ...appointment };
          // Garantir que a data seja sempre um objeto Date válido
          if (appointment.date) {
            if (typeof appointment.date === 'string') {
              updated.date = parseDateFromStorage(appointment.date);
            } else {
              updated.date = appointment.date;
            }
          }
          return updated;
        }
        return app;
      });
      
      // SINCRONIZAÇÃO EXPLÍCITA: Agenda → Orçamento
      // Se o agendamento atualizado tem orçamento associado, atualizar o orçamento
      const appointmentAtualizado = updatedAppointments.find(app => app.id === id);
      if (appointmentAtualizado && (appointment.date || appointment.time)) {
        const orcamentoId = getBudgetId(appointmentAtualizado);
        if (orcamentoId && isFromBudget(appointmentAtualizado)) {
          setOrcamentos(prevOrcamentos => {
            return prevOrcamentos.map(orc => {
              if (orc.id === orcamentoId && orc.status === 'fechado') {
                const updates: Partial<Orcamento> = {};
                if (appointment.date) {
                  updates.data = formatDateForStorage(appointmentAtualizado.date);
                }
                if (appointment.time) {
                  updates.hora = appointment.time;
                }
                return { ...orc, ...updates };
              }
              return orc;
            });
          });
        }
      }

      // SINCRONIZAÇÃO: Atualizar Projetos e workflow_sessions com nova data/hora
      if (appointmentAtualizado && (appointment.date || appointment.time)) {
        try {
          // Atualizar Projetos vinculados (agendamentoId ou orcamentoId igual ao ID do agendamento)
          const projetosVinculados = projetos.filter(p => p.agendamentoId === appointmentAtualizado.id || p.orcamentoId === appointmentAtualizado.id);
          projetosVinculados.forEach(p => {
            atualizarProjeto(p.projectId, {
              dataAgendada: appointmentAtualizado.date,
              horaAgendada: appointmentAtualizado.time
            });
          });

          // Atualizar workflow_sessions
          const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
          const dateStr = formatDateForStorage(appointmentAtualizado.date);
          const matchIds = new Set([appointmentAtualizado.id, generateSessionId(appointmentAtualizado.id)]);
          const updatedSessions = sessions.map((s: any) => {
            if (matchIds.has(s.id) || matchIds.has(s.sessionId)) {
              return { ...s, data: dateStr, hora: appointmentAtualizado.time };
            }
            return s;
          });
          localStorage.setItem('workflow_sessions', JSON.stringify(updatedSessions));
        } catch (e) {
          console.error('❌ Erro ao sincronizar data/hora com projetos e workflow_sessions:', e);
        }
      }
      
      return updatedAppointments;
    });
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(app => app.id !== id));
    
    // Remover projeto associado se existir
    const projeto = projetos.find(p => p.agendamentoId === id);
    if (projeto) {
      // Limpar recebíveis antes de excluir projeto
      ReceivablesService.removeBySessionId(projeto.projectId);
      excluirProjeto(projeto.projectId);
    }
    
    // Remover do workflow_sessions no localStorage
    try {
      const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      const matchIds = new Set([id, generateSessionId(id)]);
      const updatedSessions = workflowSessions.filter((session: any) => !(matchIds.has(session.id) || matchIds.has(session.sessionId)));
      localStorage.setItem('workflow_sessions', JSON.stringify(updatedSessions));
      console.log('✅ Agendamento removido do workflow:', id);
    } catch (error) {
      console.error('❌ Erro ao remover do workflow_sessions:', error);
    }
  };

  // Disponibilidades - Actions
  const addAvailabilitySlots = (slots: AvailabilitySlot[]) => {
    setAvailability(prev => {
      const existing = new Set(prev.map(s => `${s.date}|${s.time}`));
      const appointmentKeys = new Set(
        appointments.map(a => `${formatDateForStorage(a.date)}|${a.time}`)
      );
      // Evitar duplicados e conflitos com agendamentos
      const filtered = slots.filter(s => {
        const key = `${s.date}|${s.time}`;
        return !existing.has(key) && !appointmentKeys.has(key);
      });
      const slotsWithId = filtered.map((s, idx) => ({ ...s, id: s.id || `${Date.now()}_${idx}` }));
      return [...prev, ...slotsWithId];
    });
  };

  const clearAvailabilityForDate = (date: string) => {
    setAvailability(prev => prev.filter(s => s.date !== date));
  };

  const deleteAvailabilitySlot = (id: string) => {
    setAvailability(prev => prev.filter(s => s.id !== id));
  };

  const updateWorkflowItem = (id: string, updates: Partial<WorkflowItem>) => {
    // NOVA ARQUITETURA: Atualizar projeto diretamente
    const projeto = projetos.find(p => p.projectId === id);
    if (projeto) {
      atualizarProjeto(id, {
        nome: updates.nome || projeto.nome,
        whatsapp: updates.whatsapp || projeto.whatsapp,
        email: updates.email || projeto.email,
        descricao: updates.descricao || projeto.descricao,
        status: (updates.status as any) || projeto.status,
        categoria: updates.categoria || projeto.categoria,
        pacote: updates.pacote || projeto.pacote,
        valorPacote: updates.valorPacote ?? projeto.valorPacote,
        desconto: updates.desconto ?? projeto.desconto,
        valorFotoExtra: updates.valorFotoExtra ?? projeto.valorFotoExtra,
        qtdFotosExtra: updates.qtdFotoExtra ?? projeto.qtdFotosExtra,
        valorTotalFotosExtra: updates.valorTotalFotoExtra ?? projeto.valorTotalFotosExtra,
        produto: updates.produto || projeto.produto,
        qtdProduto: updates.qtdProduto ?? projeto.qtdProduto,
        valorTotalProduto: updates.valorTotalProduto ?? projeto.valorTotalProduto,
        valorAdicional: updates.valorAdicional ?? projeto.valorAdicional,
        detalhes: updates.detalhes || projeto.detalhes,
        valorPago: updates.valorPago ?? projeto.valorPago,
        pagamentos: updates.pagamentos ? updates.pagamentos.map(p => ({
          id: p.id,
          data: p.data,
          valor: p.valor,
          metodo: '',
          observacoes: ''
        })) : projeto.pagamentos,
        produtosList: updates.produtosList ?? projeto.produtosList
      });
    } else {
      // COMPATIBILIDADE: Manter código legado para casos especiais
      const projetoLegado = projetos.find(p => p.projectId === id);
      if (projetoLegado) {
        const updatedItem = { 
          id,
          sessionId: projetoLegado.projectId,
          data: projetoLegado.dataAgendada.toISOString().split('T')[0],
          hora: projetoLegado.horaAgendada,
          nome: projetoLegado.nome,
          whatsapp: projetoLegado.whatsapp,
          email: projetoLegado.email,
          descricao: projetoLegado.descricao,
          status: projetoLegado.status,
          categoria: projetoLegado.categoria,
          pacote: projetoLegado.pacote,
          valorPacote: projetoLegado.valorPacote,
          desconto: projetoLegado.desconto,
          valorFotoExtra: projetoLegado.valorFotoExtra,
          qtdFotoExtra: projetoLegado.qtdFotosExtra,
          valorTotalFotoExtra: projetoLegado.valorTotalFotosExtra,
          produto: projetoLegado.produto,
          qtdProduto: projetoLegado.qtdProduto,
          valorTotalProduto: projetoLegado.valorTotalProduto,
          valorAdicional: projetoLegado.valorAdicional,
          detalhes: projetoLegado.detalhes,
          total: projetoLegado.total,
          valorPago: projetoLegado.valorPago,
          restante: projetoLegado.restante,
          ...updates
        } as WorkflowItem;
        
        // Se o pacote foi alterado, atualizar categoria e valor de foto extra automaticamente
        if (updates.pacote && updates.pacote !== updatedItem.pacote) {
          const pacoteData = pacotes.find(p => p.nome === updates.pacote);
          if (pacoteData) {
            // Atualizar categoria baseado no pacote
            if (pacoteData.categoria_id) {
              const configCategorias = storage.load('configuracoes_categorias', []);
              const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
              updatedItem.categoria = categoria ? categoria.nome : String(pacoteData.categoria_id);
            } else {
              updatedItem.categoria = pacoteData.categoria || updatedItem.categoria;
            }
            
            // Atualizar valor do pacote e valor de foto extra
            updatedItem.valorPacote = pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || updatedItem.valorPacote;
            updatedItem.valorFotoExtra = pacoteData.valor_foto_extra || pacoteData.valorFotoExtra || updatedItem.valorFotoExtra;
            
            // Se o pacote tem produtos incluídos, adicionar o primeiro produto
            if (pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
              const primeiroProduto = pacoteData.produtosIncluidos[0];
              const produtoData = produtos.find(p => p.id === primeiroProduto.produtoId);
              if (produtoData) {
                updatedItem.produto = `${produtoData.nome} (incluso no pacote)`;
                updatedItem.qtdProduto = primeiroProduto.quantidade || 1;
                updatedItem.valorTotalProduto = 0; // Produtos inclusos têm valor 0
              }
            }
          }
        }
        
        // SISTEMA DE CONGELAMENTO CORRIGIDO - CÁLCULO COM REGRAS CONGELADAS
        if (updates.qtdFotoExtra !== undefined) {
          console.log('🧮 [WORKFLOW UPDATE] Recalculando foto extra para item:', id);
          console.log('📋 [WORKFLOW UPDATE] Dados atuais do item:', {
            qtdFotoExtra: updatedItem.qtdFotoExtra,
            valorFotoExtra: updatedItem.valorFotoExtra,
            temRegrasCongeladas: !!updatedItem.regrasDePrecoFotoExtraCongeladas
          });

          // Verificar se o item tem regras congeladas
          if (updatedItem.regrasDePrecoFotoExtraCongeladas) {
            // USAR REGRAS CONGELADAS - NUNCA MUDAR
            console.log('🧊 [WORKFLOW UPDATE] Usando regras congeladas específicas do item');
            
            // Validar regras antes de usar
            if (!validarRegrasCongeladas(updatedItem.regrasDePrecoFotoExtraCongeladas)) {
              console.error('❌ [WORKFLOW UPDATE] Regras congeladas inválidas, forçando migração');
              updatedItem.regrasDePrecoFotoExtraCongeladas = migrarRegrasParaItemAntigo(
                updatedItem.valorFotoExtra,
                pacotes.find(p => p.nome === updatedItem.pacote)?.categoria_id
              );
            }

            updatedItem.valorTotalFotoExtra = calcularComRegrasProprias(
              updatedItem.qtdFotoExtra,
              updatedItem.regrasDePrecoFotoExtraCongeladas
            );
            
            console.log('✅ [WORKFLOW UPDATE] Cálculo com regras congeladas concluído:', {
              quantidade: updatedItem.qtdFotoExtra,
              modelo: updatedItem.regrasDePrecoFotoExtraCongeladas.modelo,
              totalCalculado: updatedItem.valorTotalFotoExtra
            });
            
          } else {
            // MIGRAÇÃO AUTOMÁTICA: Item antigo sem regras congeladas
            console.log('🔄 [WORKFLOW UPDATE] Item antigo detectado, aplicando migração');
            
            // PRESERVAR o valor original que estava no item quando foi criado
            const valorOriginalStr = typeof updatedItem.valorFotoExtra === 'string' 
              ? updatedItem.valorFotoExtra 
              : String(updatedItem.valorFotoExtra || 'R$ 35,00');
            const valorOriginalPreservado = parseFloat(valorOriginalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 35;
            
            console.log('💾 [WORKFLOW UPDATE] Preservando valor histórico:', {
              valorOriginalStr,
              valorOriginalPreservado,
              descricao: updatedItem.descricao
            });
            
            updatedItem.regrasDePrecoFotoExtraCongeladas = migrarRegrasParaItemAntigo(
              valorOriginalPreservado,
              pacotes.find(p => p.nome === updatedItem.pacote)?.categoria_id
            );
            
            // Recalcular usando as regras congeladas recém-criadas
            updatedItem.valorTotalFotoExtra = calcularComRegrasProprias(
              updatedItem.qtdFotoExtra,
              updatedItem.regrasDePrecoFotoExtraCongeladas
            );
            
            // Atualizar campo visual com valor correto
            updatedItem.valorFotoExtra = formatCurrency(valorOriginalPreservado) as any;
            
            console.log('✅ [WORKFLOW UPDATE] Migração concluída:', {
              quantidade: updatedItem.qtdFotoExtra,
              valorPreservado: valorOriginalPreservado,
              totalCalculado: updatedItem.valorTotalFotoExtra,
              regrasGeradas: updatedItem.regrasDePrecoFotoExtraCongeladas
            });
          }
        } else if (updates.valorFotoExtra !== undefined) {
          // ATUALIZAÇÃO MANUAL DO VALOR FOTO EXTRA
          console.log('⚠️ [WORKFLOW UPDATE] Tentativa de alterar valorFotoExtra manualmente');
          
          if (updatedItem.regrasDePrecoFotoExtraCongeladas) {
            // REGRAS CONGELADAS EXISTEM: NÃO permitir alteração manual
            console.log('🔒 [WORKFLOW UPDATE] Bloqueando alteração - regras congeladas protegem este valor');
            
            // Recalcular usando regras congeladas (ignorar valor manual)
            updatedItem.valorTotalFotoExtra = calcularComRegrasProprias(
              updatedItem.qtdFotoExtra || 0,
              updatedItem.regrasDePrecoFotoExtraCongeladas
            );
            
            // Manter valor visual consistente com as regras
            if (updatedItem.regrasDePrecoFotoExtraCongeladas.modelo === 'fixo') {
              updatedItem.valorFotoExtra = formatCurrency(updatedItem.regrasDePrecoFotoExtraCongeladas.valorFixo || 0) as any;
            }
            
            console.log('✅ [WORKFLOW UPDATE] Valor protegido mantido:', {
              modelo: updatedItem.regrasDePrecoFotoExtraCongeladas.modelo,
              valorFotoExtra: updatedItem.valorFotoExtra,
              totalRecalculado: updatedItem.valorTotalFotoExtra
            });
          } else {
            // Item sem regras congeladas: permitir alteração e criar regras
            console.log('🔄 [WORKFLOW UPDATE] Criando regras congeladas com novo valor');
            
            const valorStr = typeof updatedItem.valorFotoExtra === 'string' 
              ? updatedItem.valorFotoExtra 
              : String(updatedItem.valorFotoExtra || '0');
            const novoValor = parseFloat(valorStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            
            updatedItem.regrasDePrecoFotoExtraCongeladas = migrarRegrasParaItemAntigo(
              novoValor,
              pacotes.find(p => p.nome === updatedItem.pacote)?.categoria_id
            );
            
            updatedItem.valorTotalFotoExtra = calcularComRegrasProprias(
              updatedItem.qtdFotoExtra || 0,
              updatedItem.regrasDePrecoFotoExtraCongeladas
            );
          }
        } else {
          // OUTROS CAMPOS: Manter cálculo atual se já existe
          if (updatedItem.valorTotalFotoExtra === undefined || updatedItem.valorTotalFotoExtra === null) {
            updatedItem.valorTotalFotoExtra = updatedItem.qtdFotoExtra * (updatedItem.valorFotoExtra || 0);
          }
        }
        
        updatedItem.total = updatedItem.valorPacote + updatedItem.valorTotalFotoExtra + 
                           updatedItem.valorTotalProduto + updatedItem.valorAdicional - updatedItem.desconto;
        updatedItem.restante = updatedItem.total - updatedItem.valorPago;
        
        // ===== SINCRONIZAÇÃO BIDIRECIONAL - APENAS ATUALIZAR, NUNCA CRIAR NOVO =====
        try {
          const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
          
          // Buscar por múltiplos critérios para evitar duplicação
          const sessionIndex = workflowSessions.findIndex((s: any) => 
            s.id === id || 
            s.sessionId === updatedItem.sessionId ||
            (s.clienteId === updatedItem.clienteId && s.nome === updatedItem.nome && s.data === updatedItem.data)
          );
          
          if (sessionIndex >= 0) {
            // SEMPRE atualizar sessão existente, NUNCA criar nova
            const existingSession = workflowSessions[sessionIndex];
            const sessionUpdate = {
              ...existingSession,
              // Preservar IDs originais para evitar duplicação
              id: existingSession.id,
              sessionId: existingSession.sessionId || existingSession.id,
              // Atualizar dados do workflow
              nome: updatedItem.nome,
              whatsapp: updatedItem.whatsapp,
              email: updatedItem.email,
              descricao: updatedItem.descricao,
              status: updatedItem.status,
              categoria: updatedItem.categoria,
              pacote: updatedItem.pacote,
              valorPacote: updatedItem.valorPacote,
              desconto: updatedItem.desconto,
              valorFotoExtra: updatedItem.valorFotoExtra,
              qtdFotoExtra: updatedItem.qtdFotoExtra,
              valorTotalFotoExtra: updatedItem.valorTotalFotoExtra,
              produto: updatedItem.produto,
              qtdProduto: updatedItem.qtdProduto,
              valorTotalProduto: updatedItem.valorTotalProduto,
              valorAdicional: updatedItem.valorAdicional,
              detalhes: updatedItem.detalhes,
              total: updatedItem.total,
              valorPago: updatedItem.valorPago,
              restante: updatedItem.restante,
              pagamentos: updatedItem.pagamentos || existingSession.pagamentos || [],
              produtosList: updatedItem.produtosList || existingSession.produtosList || [],
              dataUltimaAtualizacao: new Date().toISOString()
            };
            
            workflowSessions[sessionIndex] = sessionUpdate;
            localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessions));
            
            console.log('✅ Atualizado workflow_sessions (SEM DUPLICAÇÃO):', { id, sessionId: sessionUpdate.sessionId });
          } else {
            console.warn('⚠️ Sessão não encontrada para atualização:', { id, clienteId: updatedItem.clienteId, nome: updatedItem.nome });
          }
        } catch (error) {
          console.error('❌ Erro ao sincronizar updateWorkflowItem:', error);
        }
        
        return updatedItem;
      }
    }
  };

  const addPayment = (id: string, valor: number) => {
    const pagamento = {
      id: Date.now().toString(),
      valor,
      data: getCurrentDateString()
    };

    // NOVA ARQUITETURA: Adicionar pagamento ao projeto
    const projeto = projetos.find(p => p.projectId === id);
    if (projeto) {
      const novosPagamentos = [...projeto.pagamentos, pagamento];
      const novoValorPago = novosPagamentos.reduce((sum, p) => sum + p.valor, 0);
      
      atualizarProjeto(id, {
        pagamentos: novosPagamentos.map(p => ({
          id: p.id,
          data: p.data,
          valor: p.valor,
          metodo: 'dinheiro',
          observacoes: ''
        })),
        valorPago: novoValorPago,
        restante: projeto.total - novoValorPago
      });
    } else {
      // COMPATIBILIDADE LEGADA
      const item = workflowItems.find(w => w.id === id);
      if (item) {
        const updatedPagamentos = [...item.pagamentos, pagamento];
        const novoValorPago = updatedPagamentos.reduce((sum, p) => sum + p.valor, 0);
        
        const updatedItem = {
          ...item,
          pagamentos: updatedPagamentos,
          valorPago: novoValorPago,
          restante: item.total - novoValorPago
        };
        
        // ===== SINCRONIZAÇÃO BIDIRECIONAL =====
        // Também salvar em workflow_sessions para garantir persistência
        try {
          const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
          const sessionIndex = workflowSessions.findIndex((s: any) => s.id === id);
          
          if (sessionIndex >= 0) {
            workflowSessions[sessionIndex] = {
              ...workflowSessions[sessionIndex],
              valorPago: formatCurrency(updatedItem.valorPago),
              restante: formatCurrency(updatedItem.restante),
              pagamentos: updatedItem.pagamentos
            };
            
            localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessions));
            console.log('✅ Sincronizado addPayment:', { id, valor, novoValorPago });
          }
        } catch (error) {
          console.error('❌ Erro ao sincronizar addPayment:', error);
        }
        
        return updatedItem;
      }
    }
  };

  const toggleColumnVisibility = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const updateWorkflowFilters = (newFilters: Partial<WorkflowFilters>) => {
    setWorkflowFilters(prev => ({ ...prev, ...newFilters }));
  };

  const navigateMonth = (direction: number) => {
    const [currentMonth, currentYear] = workflowFilters.mes.split('/').map(Number);
    let newMonth = currentMonth + direction;
    let newYear = currentYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    updateWorkflowFilters({ mes: `${newMonth}/${newYear}` });
  };

  // Funções de Cartões de Crédito (NOVO) - Agora usando FinancialEngine
  const adicionarCartao = (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => {
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
  };

  const atualizarCartao = (id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => {
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
  };

  const removerCartao = (id: string) => {
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
  };

  // Motor Financeiro Centralizado (NOVO)
  const createTransactionEngine = (input: CreateTransactionInput) => {
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
  };

  const contextValue: AppContextType = {
    // Data
    orcamentos,
    templates,
    origens,
    clientes,
    categorias,
    produtos,
    pacotes,
    metricas,
    appointments,
    availability,
    workflowItemsAll: workflowItems,
    workflowItems: workflowItems.filter(item => {
      // Handle ISO date format (YYYY-MM-DD) from new Projeto structure
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1; // 1-12
      const itemYear = itemDate.getFullYear();
      
      const [filterMonth, filterYear] = workflowFilters.mes.split('/');
      const monthMatches = itemMonth === parseInt(filterMonth) && itemYear === parseInt(filterYear);

      const searchMatches = !workflowFilters.busca || 
        item.nome.toLowerCase().includes(workflowFilters.busca.toLowerCase());

      return monthMatches && searchMatches;
    }).sort((a, b) => {
      const dateA = a.dataOriginal || parseDateFromStorage(a.data);
      const dateB = b.dataOriginal || parseDateFromStorage(b.data);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      const timeA = a.hora.split(':').map(Number);
      const timeB = b.hora.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    }),
    workflowSummary,
    workflowFilters,
    visibleColumns,
    cartoes,
    
    // Actions
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
    addAppointment,
    updateAppointment,
    deleteAppointment,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    updateWorkflowItem,
    addPayment,
    toggleColumnVisibility,
    updateWorkflowFilters,
    navigateMonth,
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    createTransactionEngine,
    
    // Utilities
    isFromBudget,
    getBudgetId,
    canEditFully,
    
    // Cliente pré-selecionado para agendamento
    selectedClientForScheduling,
    setSelectedClientForScheduling,
    clearSelectedClientForScheduling
  };

  // Sistema de inicialização e correções automáticas
  useEffect(() => {
    let mounted = true;
    
    const runInitialization = async () => {
      try {
        // Verificar se precisa de inicialização
        if (needsInitialization()) {
          // console.log('🔧 Executando inicialização automática do sistema...');
          const result = await initializeApp();
          
          if (mounted && result.success) {
            // console.log('✅ Sistema inicializado com sucesso');
          }
        }
        
        // Executar correção de clienteId nas sessões e agendamentos existentes
        corrigirClienteIdSessoes();
        corrigirClienteIdAgendamentos();
      } catch (error) {
        console.error('❌ Erro na inicialização automática:', error);
      }
    };
    
    // Executar com um pequeno delay para garantir que tudo esteja carregado
    const timer = setTimeout(runInitialization, 500);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []); // Executar apenas uma vez na inicialização

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};