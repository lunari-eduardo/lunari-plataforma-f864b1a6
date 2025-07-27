import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { FinancialEngine, CreateTransactionInput } from '@/services/FinancialEngine';
import { calculateTotals, calculateTotalsNew } from '@/services/FinancialCalculationEngine';
import { autoMigrateIfNeeded } from '@/utils/dataMoveMigration';

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

  // Workflow State
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>(() => {
    return storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
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

  // Função de sincronização direta com workflow (NOVA ARQUITETURA)
  const sincronizarComWorkflow = useCallback((orcamento: Orcamento) => {
    if (!orcamento || orcamento.status !== 'fechado') return;

    console.log('=== SINCRONIZANDO COM WORKFLOW (NOVA ARQUITETURA) ===');
    console.log('Orçamento completo:', orcamento);

    // FUNÇÃO AUXILIAR: Extrair produtos padronizados do orçamento
    const extrairProdutosDoOrcamento = (orcamento: any): { produtosList: any[], valorPacote: number, valorProdutosManuais: number } => {
      const produtosList: any[] = [];
      let valorPacote = 0;
      let valorProdutosManuais = 0;

      // PRIMEIRA PRIORIDADE: Nova estrutura (pacotePrincipal + produtosAdicionais)
      if (orcamento.pacotePrincipal || orcamento.produtosAdicionais) {
        console.log('✅ Usando nova estrutura de dados');
        
        valorPacote = orcamento.pacotePrincipal?.valorCongelado || 0;
        
        // Produtos inclusos do pacote principal
        if (orcamento.pacotePrincipal?.produtosIncluidos) {
          produtosList.push(...orcamento.pacotePrincipal.produtosIncluidos.map((p: any) => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: 0, // Produtos inclusos não somam
            tipo: 'incluso'
          })));
        }
        
        // Produtos manuais adicionais
        if (orcamento.produtosAdicionais) {
          const produtosManuais = orcamento.produtosAdicionais.map((p: any) => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: p.valorUnitarioCongelado,
            tipo: 'manual'
          }));
          
          produtosList.push(...produtosManuais);
          valorProdutosManuais = orcamento.produtosAdicionais.reduce((total: number, p: any) => 
            total + (p.valorUnitarioCongelado * p.quantidade), 0);
        }
        
        return { produtosList, valorPacote, valorProdutosManuais };
      }

      // SEGUNDA PRIORIDADE: Migração automática da estrutura antiga
      console.log('⚠️ Migrando estrutura antiga para nova estrutura');
      
      const pacotePrincipal = orcamento.pacotes?.[0];
      const produtosAdicionais = orcamento.pacotes?.slice(1) || [];
      
      // Buscar dados do pacote para produtos inclusos
      let pacoteData = null;
      if (pacotePrincipal) {
        const cleanPackageId = pacotePrincipal.id?.replace(/^(pacote-|orcamento-)/, '') || '';
        const packageName = pacotePrincipal.nome?.replace(/^Pacote:\s*/, '') || '';
        
        pacoteData = pacotes.find(p => p.id === pacotePrincipal.id) ||
                    pacotes.find(p => p.id === cleanPackageId) ||
                    pacotes.find(p => p.nome === packageName) ||
                    pacotes.find(p => p.nome === pacotePrincipal.nome);
        
        if (pacoteData?.produtosIncluidos) {
          produtosList.push(...pacoteData.produtosIncluidos.map((produtoIncluido: any) => {
            const produto = produtos.find(p => p.id === produtoIncluido.produtoId);
            return produto ? {
              nome: produto.nome,
              quantidade: produtoIncluido.quantidade,
              valorUnitario: 0, // Produtos inclusos não somam
              tipo: 'incluso'
            } : null;
          }).filter(Boolean));
        }
      }
      
      // Produtos manuais da estrutura antiga
      const produtosManuais = produtosAdicionais.filter(p => !p.id?.startsWith('auto-'));
      produtosList.push(...produtosManuais.map(p => ({
        nome: p.nome,
        quantidade: p.quantidade,
        valorUnitario: p.preco,
        tipo: 'manual'
      })));
      
      valorPacote = orcamento.valorManual || pacotePrincipal?.preco || pacoteData?.valor_base || 0;
      valorProdutosManuais = produtosManuais.reduce((acc, p) => acc + (p.preco * p.quantidade), 0);
      
      return { produtosList, valorPacote, valorProdutosManuais };
    };

    // LÓGICA UNIFICADA: Sempre usar a função auxiliar
    const { produtosList, valorPacote, valorProdutosManuais } = extrairProdutosDoOrcamento(orcamento);
    
    const valorTotal = orcamento.valorFinal || valorPacote + valorProdutosManuais;
    const nomePacote = orcamento.pacotePrincipal?.nome || 
                      orcamento.pacotes?.[0]?.nome?.replace(/^Pacote:\s*/, '') || 
                      '';

    const sessaoWorkflow = {
      id: `orcamento-${orcamento.id}`,
      data: orcamento.data,
      hora: orcamento.hora,
      nome: orcamento.cliente?.nome || '',
      email: orcamento.cliente?.email || '',
      whatsapp: orcamento.cliente?.telefone || '',
      descricao: orcamento.descricao || '',
      detalhes: orcamento.detalhes || '',
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
      desconto: 0,
      valor: formatCurrency(valorTotal),
      total: formatCurrency(valorTotal),
      valorPago: formatCurrency(0),
      restante: formatCurrency(valorTotal),
      status: '',
      pagamentos: [],
      fonte: 'orcamento',
      dataOriginal: parseDateFromStorage(orcamento.data),
      produtosList: produtosList
    };

    console.log('✅ Dados sincronizados com estrutura unificada:', sessaoWorkflow);

    // Salvar no localStorage do workflow
    const saved = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const existingIndex = saved.findIndex((s: any) => s.id === sessaoWorkflow.id);
    
    if (existingIndex >= 0) {
      saved[existingIndex] = sessaoWorkflow;
    } else {
      saved.push(sessaoWorkflow);
    }
    
    localStorage.setItem('workflow_sessions', JSON.stringify(saved));
    console.log('✅ Workflow sincronizado com sucesso');
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

  useEffect(() => {
    storage.save(STORAGE_KEYS.WORKFLOW_ITEMS, workflowItems);
  }, [workflowItems]);

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
    const cancelados = orcamentosMes.filter(o => o.status === 'cancelado').length;
    const pendentes = orcamentosMes.filter(o => o.status === 'pendente').length;

    setMetricas({
      totalMes: orcamentosMes.length,
      enviados,
      fechados,
      cancelados,
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
  useEffect(() => {
    const confirmedAppointments = appointments.filter(app => app.status === 'confirmado');
    
    const newItems: WorkflowItem[] = [];
    
    confirmedAppointments.forEach(appointment => {
      const existingItem = workflowItems.find(item => 
        item.id === `agenda-${appointment.id}` && item.fonte === 'agenda'
      );
      
      if (!existingItem) {
        // Buscar dados do pacote selecionado
        let pacoteData = null;
        let categoriaName = '';
        let valorFotoExtraFromPackage = 35; // valor padrão
        
        if (appointment.packageId) {
          pacoteData = pacotes.find(p => p.id === appointment.packageId);
          if (pacoteData) {
            // Buscar categoria pelo ID do pacote
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
        
        // Se não há pacote específico, usar lógica de fallback baseada no tipo
        if (!pacoteData) {
          categoriaName = appointment.type.includes('Gestante') ? 'Gestante' : 
                        appointment.type.includes('Família') ? 'Família' : 
                        appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros';
        }

        const newWorkflowItem: WorkflowItem = {
          id: `agenda-${appointment.id}`,
          data: formatDateForStorage(appointment.date),
          hora: appointment.time,
          nome: appointment.client,
          whatsapp: (appointment as any).clientPhone || appointment.whatsapp || "+55 (11) 99999-9999",
          email: (appointment as any).clientEmail || appointment.email || "",
          descricao: appointment.description || '',
          status: "",
          categoria: categoriaName,
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
          dataOriginal: appointment.date
        };

        // CORREÇÃO: Adicionar TODOS os produtos incluídos do agendamento
        let allProductsFromAppointment: ProdutoWorkflow[] = [];
        
        // Produtos incluídos salvos diretamente no agendamento
        if (appointment.produtosIncluidos && appointment.produtosIncluidos.length > 0) {
          allProductsFromAppointment = appointment.produtosIncluidos.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: 0, // Produtos inclusos têm valor 0 para cálculos
            tipo: 'incluso' as const
          }));
        }
        // Fallback: buscar produtos do pacote se não estiverem salvos no agendamento
        else if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
          allProductsFromAppointment = pacoteData.produtosIncluidos.map(produtoIncluido => {
            const produtoData = produtos.find(p => p.id === produtoIncluido.produtoId);
            return {
              nome: produtoData?.nome || 'Produto não encontrado',
              quantidade: produtoIncluido.quantidade || 1,
              valorUnitario: 0, // Produtos inclusos têm valor 0 para cálculos
              tipo: 'incluso' as const
            };
          });
        }

        // Adicionar lista completa de produtos
        newWorkflowItem.produtosList = allProductsFromAppointment;

        // Para compatibilidade com sistema atual - usar primeiro produto
        if (allProductsFromAppointment.length > 0) {
          const primeiroProduto = allProductsFromAppointment[0];
          newWorkflowItem.produto = `${primeiroProduto.nome} (incluso no pacote)`;
          newWorkflowItem.qtdProduto = primeiroProduto.quantidade;
          newWorkflowItem.valorTotalProduto = primeiroProduto.valorUnitario * primeiroProduto.quantidade;
        }

        // NOVA LÓGICA: Total = Valor do pacote + fotos extra + produtos manuais (produtos inclusos não somam)
        newWorkflowItem.total = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                               newWorkflowItem.valorTotalProduto + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
        newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

        newItems.push(newWorkflowItem);
      }
    });

    if (newItems.length > 0) {
      setWorkflowItems(prev => [...prev, ...newItems]);
    }
  }, [appointments, workflowItems, pacotes, categorias, produtos]);

  // Process closed budgets to workflow
  useEffect(() => {
    const orcamentosFechados = orcamentos.filter(orc => orc.status === 'fechado');
    
    const newItems: WorkflowItem[] = [];
    
    orcamentosFechados.forEach(orc => {
      const existingItem = workflowItems.find(item => 
        item.id === `orcamento-${orc.id}` && item.fonte === 'orcamento'
      );
      
      // CORREÇÃO: Sempre atualizar a descrição, mesmo para items existentes
      if (existingItem) {
        existingItem.descricao = orc.descricao || '';
        return; // Item já existe, apenas atualizamos a descrição
      }
      
      // Buscar dados do pacote do orçamento
      let pacoteData = null;
      let categoriaName = orc.categoria;
      let valorFotoExtraFromPackage = 35;
      let valorPacoteFromBudget = 0;
      
      if (orc.pacotes && orc.pacotes.length > 0) {
        const pacoteOrcamento = orc.pacotes[0];
        
        console.log('DEBUG: Buscando pacote para workflow', {
          pacoteOrcamento,
          pacotesDisponiveis: pacotes,
          orcamentoCompleto: orc
        });
        
        // CORREÇÃO DEFINITIVA: Busca inteligente do pacote com múltiplos fallbacks
        let pacoteId = pacoteOrcamento.id;
        
        // 1. Buscar por ID exato primeiro
        pacoteData = pacotes.find(p => p.id === pacoteId);
        
        // 2. Fallback: remover prefixos e buscar por ID limpo
        if (!pacoteData && pacoteId) {
          const idLimpo = pacoteId.replace(/^pacote-/, '');
          pacoteData = pacotes.find(p => p.id === idLimpo);
        }
        
        // 3. Fallback: buscar por nome
        if (!pacoteData && pacoteOrcamento.nome) {
          pacoteData = pacotes.find(p => p.nome === pacoteOrcamento.nome);
        }
        
        // 4. Fallback: usar valores do orçamento se não encontrar na configuração
        if (!pacoteData) {
          console.log('DEBUG: Pacote não encontrado na configuração, usando dados do orçamento');
          pacoteData = {
            id: pacoteOrcamento.id,
            nome: pacoteOrcamento.nome,
            valor: pacoteOrcamento.preco || 0,
            valor_base: pacoteOrcamento.preco || 0,
            valorVenda: pacoteOrcamento.preco || 0
          };
        }
        
        console.log('DEBUG: Resultado da busca de pacote:', { 
          encontrado: !!pacoteData, 
          pacoteData,
          valorPacote: pacoteData?.valor || pacoteOrcamento.preco || 0
        });
        
        if (pacoteData) {
          // Buscar categoria pelo ID do pacote
          if (pacoteData.categoria_id) {
            const configCategorias = storage.load('configuracoes_categorias', []);
            const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
            categoriaName = categoria ? categoria.nome : String(pacoteData.categoria_id);
          } else {
            categoriaName = pacoteData.categoria || orc.categoria;
          }
          valorFotoExtraFromPackage = pacoteData.valor_foto_extra || pacoteData.valorFotoExtra || 35;
          // Usar valor do pacote nas configurações como congelamento
          valorPacoteFromBudget = pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || 0;
        } else {
          // Se não encontrou o pacote nas configurações, usar dados do orçamento
          valorPacoteFromBudget = pacoteOrcamento.preco || 0;
        }
      }

      const newWorkflowItem: WorkflowItem = {
        id: `orcamento-${orc.id}`,
        data: orc.data,
        hora: orc.hora,
        nome: orc.cliente.nome,
        whatsapp: orc.cliente.telefone,
        email: orc.cliente.email,
        descricao: orc.descricao || '',
        status: 'Fechado',
        categoria: categoriaName,
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
        dataOriginal: parseDateFromStorage(orc.data)
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

      // NOVA LÓGICA: Total = Valor do pacote + produtos manuais (produtos inclusos não somam)
      const valorProdutosManuaisOrc = todosProdutosDoOrcamento
        ?.filter(p => p.tipo === 'manual')
        ?.reduce((total, p) => total + (p.valorUnitario * p.quantidade), 0) || 0;
      
      newWorkflowItem.total = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                             valorProdutosManuaisOrc + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
      newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

      newItems.push(newWorkflowItem);
    });

    if (newItems.length > 0) {
      setWorkflowItems(prev => [...prev, ...newItems]);
    }
  }, [orcamentos, workflowItems, pacotes, produtos]);

  // Calculate workflow summary
  const workflowSummary = React.useMemo(() => {
    const filteredItems = workflowItems.filter(item => {
      const [itemDay, itemMonth, itemYear] = item.data.split('/');
      const [filterMonth, filterYear] = workflowFilters.mes.split('/');
      const monthMatches = itemMonth === filterMonth && itemYear === filterYear;

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
        const mudouParaCancelado = statusAtual === 'cancelado';
        
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
            sincronizarComWorkflow(orcamentoAtualizado);
            
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
        
        // Remover item do workflow quando orçamento não está mais fechado
        if (mudouDeFechado) {
          setWorkflowItems(prevWorkflow => {
            return prevWorkflow.filter(item => item.id !== `orcamento-${id}`);
          });
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
    const novoCliente: Cliente = {
      ...cliente,
      id: Date.now().toString(),
    };
    console.log('Adding new client:', novoCliente);
    console.log('Current clients before adding:', clientes.length);
    setClientes(prev => {
      const existingClients = [...prev];
      const updatedClients = [...existingClients, novoCliente];
      console.log('Updated clients count:', updatedClients.length);
      return updatedClients;
    });
    return novoCliente;
  };

  const atualizarCliente = (id: string, dadosAtualizados: Partial<Cliente>) => {
    setClientes(prev => prev.map(cliente => 
      cliente.id === id ? { ...cliente, ...dadosAtualizados } : cliente
    ));
  };

  const removerCliente = (id: string) => {
    setClientes(prev => prev.filter(cliente => cliente.id !== id));
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
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
    };
    setAppointments(prev => [...prev, newAppointment]);
    return newAppointment;
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
      
      return updatedAppointments;
    });
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(app => app.id !== id));
  };

  const updateWorkflowItem = (id: string, updates: Partial<WorkflowItem>) => {
    setWorkflowItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, ...updates };
        
        // Se o pacote foi alterado, atualizar categoria e valor de foto extra automaticamente
        if (updates.pacote && updates.pacote !== item.pacote) {
          const pacoteData = pacotes.find(p => p.nome === updates.pacote);
          if (pacoteData) {
            // Atualizar categoria baseado no pacote
            if (pacoteData.categoria_id) {
              const configCategorias = storage.load('configuracoes_categorias', []);
              const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
              updatedItem.categoria = categoria ? categoria.nome : String(pacoteData.categoria_id);
            } else {
              updatedItem.categoria = pacoteData.categoria || item.categoria;
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
        
        updatedItem.valorTotalFotoExtra = updatedItem.qtdFotoExtra * updatedItem.valorFotoExtra;
        updatedItem.total = updatedItem.valorPacote + updatedItem.valorTotalFotoExtra + 
                           updatedItem.valorTotalProduto + updatedItem.valorAdicional - updatedItem.desconto;
        updatedItem.restante = updatedItem.total - updatedItem.valorPago;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addPayment = (id: string, valor: number) => {
    const pagamento = {
      id: Date.now().toString(),
      valor,
      data: getCurrentDateString()
    };

    setWorkflowItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedPagamentos = [...item.pagamentos, pagamento];
        const novoValorPago = updatedPagamentos.reduce((sum, p) => sum + p.valor, 0);
        
        return {
          ...item,
          pagamentos: updatedPagamentos,
          valorPago: novoValorPago,
          restante: item.total - novoValorPago
        };
      }
      return item;
    }));
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
    workflowItems: workflowItems.filter(item => {
      const [itemDay, itemMonth, itemYear] = item.data.split('/');
      const [filterMonth, filterYear] = workflowFilters.mes.split('/');
      const monthMatches = itemMonth === filterMonth && itemYear === filterYear;

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
    canEditFully
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};