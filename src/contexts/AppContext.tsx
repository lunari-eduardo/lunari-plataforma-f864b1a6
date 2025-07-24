import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { parseDateFromStorage, formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { toast } from '@/hooks/use-toast';

// Types
import { Orcamento, Template, OrigemCliente, MetricasOrcamento, Cliente } from '@/types/orcamentos';
import { Appointment, AppointmentStatus } from '@/hooks/useAgenda';

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
  produto: string;
  qtdProduto: number;
  valorTotalProduto: number;
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
  // Orçamentos State
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() => {
    return storage.load(STORAGE_KEYS.BUDGETS, []);
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

  // Estado dos Cartões de Crédito (NOVO)
  const [cartoes, setCartoes] = useState(() => {
    return storage.load('lunari_fin_credit_cards', []);
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

  // Persistir cartões (NOVO)
  useEffect(() => {
    storage.save('lunari_fin_credit_cards', cartoes);
  }, [cartoes]);

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
  // SINCRONIZAÇÃO REFATORADA: SEPARAÇÃO CLARA DE RESPONSABILIDADES
  // ===================================================================
  
  // 🔒 CRIADOR/DESTRUIDOR/ATUALIZADOR: Orçamento → Agenda
  // Responsabilidade: Criar agendamentos quando orçamento fica 'fechado'
  //                  Remover agendamentos quando orçamento é cancelado ou deixa de ser 'fechado'
  //                  Atualizar datas de agendamentos quando orçamento fechado muda data/hora
  const syncOrcamentoToAgenda = useCallback(() => {
    let appointmentsToRemove: string[] = [];
    let appointmentsToAdd: Appointment[] = [];
    let appointmentsToUpdate: { id: string; date: Date; time: string }[] = [];

    orcamentos.forEach(orcamento => {
      const existingAppointment = appointments.find(app => 
        app.id === `orcamento-${orcamento.id}` || 
        (app as any).orcamentoId === orcamento.id
      );

      if (orcamento.status === 'fechado') {
        if (!existingAppointment) {
          // CRIAR agendamento se não existe
          const appointmentDate = parseDateFromStorage(orcamento.data);
          
          if (isNaN(appointmentDate.getTime())) {
            console.warn(`Data inválida no orçamento ${orcamento.id}: ${orcamento.data}`);
            return;
          }
          
          const newAppointment: Appointment = {
            id: `orcamento-${orcamento.id}`,
            title: orcamento.cliente.nome,
            date: appointmentDate,
            time: orcamento.hora,
            type: orcamento.categoria,
            client: orcamento.cliente.nome,
            status: 'confirmado',
            description: orcamento.descricao || orcamento.detalhes,
            packageId: orcamento.pacotes[0]?.id || undefined,
            paidAmount: 0,
            email: orcamento.cliente.email,
            whatsapp: orcamento.cliente.telefone,
            orcamentoId: orcamento.id,
            origem: 'orcamento'
          };

          appointmentsToAdd.push(newAppointment);
        } else {
          // ATUALIZAR agendamento existente se data/hora do orçamento mudou
          const orcamentoDate = parseDateFromStorage(orcamento.data);
          
          if (!isNaN(orcamentoDate.getTime())) {
            const needsUpdate = 
              orcamentoDate.getTime() !== existingAppointment.date.getTime() ||
              orcamento.hora !== existingAppointment.time;
            
            if (needsUpdate) {
              appointmentsToUpdate.push({
                id: existingAppointment.id,
                date: orcamentoDate,
                time: orcamento.hora
              });
            }
          }
        }
      } else {
        // REMOVER agendamento se orçamento não está mais 'fechado'
        if (existingAppointment) {
          appointmentsToRemove.push(existingAppointment.id);
        }
      }
    });

    // Aplicar mudanças em uma única atualização
    if (appointmentsToAdd.length > 0 || appointmentsToRemove.length > 0 || appointmentsToUpdate.length > 0) {
      setAppointments(prev => {
        let newAppointments = [...prev];
        
        // Remover agendamentos
        if (appointmentsToRemove.length > 0) {
          newAppointments = newAppointments.filter(app => !appointmentsToRemove.includes(app.id));
        }
        
        // Adicionar novos agendamentos
        if (appointmentsToAdd.length > 0) {
          newAppointments = [...newAppointments, ...appointmentsToAdd];
        }
        
        // Atualizar agendamentos existentes
        if (appointmentsToUpdate.length > 0) {
          newAppointments = newAppointments.map(app => {
            const updateData = appointmentsToUpdate.find(u => u.id === app.id);
            if (updateData) {
              return { ...app, date: updateData.date, time: updateData.time };
            }
            return app;
          });
        }
        
        return newAppointments;
      });

      // Toasts informativos
      if (appointmentsToAdd.length > 0) {
        appointmentsToAdd.forEach(app => {
          toast({
            title: "Agendamento criado automaticamente",
            description: `Orçamento de ${app.client} foi confirmado e adicionado à agenda.`,
          });
        });
      }
      
      if (appointmentsToRemove.length > 0) {
        const removedFromCanceled = orcamentos.filter(orc => 
          (orc.status === 'cancelado' || orc.status !== 'fechado') && 
          appointmentsToRemove.some(id => id === `orcamento-${orc.id}`)
        );
        
        removedFromCanceled.forEach(orc => {
          toast({
            title: "Agendamento removido",
            description: `Orçamento de ${orc.cliente.nome} foi removido da agenda.`,
            variant: "destructive"
          });
        });
      }
    }
  }, [orcamentos, appointments]);

  // 📅 ATUALIZADOR: Agenda → Orçamento (APENAS atualizar datas)
  // Responsabilidade: Atualizar datas/horas no orçamento quando agendamento muda
  //                  (Agendamento é o mestre da DATA após criação)
  const syncAgendaToOrcamento = useCallback(() => {
    let orcamentoUpdates: { id: string; data: string; hora: string }[] = [];

    appointments.forEach(appointment => {
      const orcamentoId = getBudgetId(appointment);
      if (orcamentoId && isFromBudget(appointment)) {
        // Usar setOrcamentos com callback para acessar o estado atual
        // sem adicionar orcamentos às dependências
        setOrcamentos(prevOrcamentos => {
          const orcamento = prevOrcamentos.find(orc => orc.id === orcamentoId);
          if (orcamento && orcamento.status === 'fechado') {
            const appointmentDateString = formatDateForStorage(appointment.date);
            
            if (orcamento.data !== appointmentDateString || orcamento.hora !== appointment.time) {
              // Atualizar o orçamento específico
              return prevOrcamentos.map(o => 
                o.id === orcamentoId 
                  ? { ...o, data: appointmentDateString, hora: appointment.time }
                  : o
              );
            }
          }
          return prevOrcamentos; // Retornar sem mudanças se não precisar atualizar
        });
      }
    });
  }, [appointments, getBudgetId, isFromBudget]); // Removido 'orcamentos' das dependências

  // ===================================================================
  // EXECUÇÃO DOS SYNCS: SEPARADOS E SEM DEPENDÊNCIAS CRUZADAS
  // ===================================================================
  
  // 🔒 CRIADOR/DESTRUIDOR/ATUALIZADOR: Executa quando orçamentos ou appointments mudam
  useEffect(() => {
    syncOrcamentoToAgenda();
  }, [orcamentos, appointments]); // Ambos necessários para sincronização bidirecional
  
  // 📅 ATUALIZADOR: Executa APENAS quando agendamentos mudam
  useEffect(() => {
    syncAgendaToOrcamento();
  }, [appointments]); // APENAS appointments - sem orcamentos para evitar loop

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
          descricao: appointment.type,
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

        // Adicionar produtos incluídos no pacote
        if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
          const primeiroproduto = pacoteData.produtosIncluidos[0];
          const produtoData = produtos.find(p => p.id === primeiroproduto.produtoId);
          if (produtoData) {
            newWorkflowItem.produto = produtoData.nome;
            newWorkflowItem.qtdProduto = primeiroproduto.quantidade || 1;
            newWorkflowItem.valorTotalProduto = (produtoData.valorVenda || produtoData.preco_venda || 0) * newWorkflowItem.qtdProduto;
          }
        }

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
      
      if (!existingItem) {
        // Buscar dados do pacote do orçamento
        let pacoteData = null;
        let categoriaName = orc.categoria;
        let valorFotoExtraFromPackage = 35;
        
        if (orc.pacotes && orc.pacotes.length > 0) {
          const pacoteOrcamento = orc.pacotes[0];
          
          // Buscar o pacote completo nos dados de configuração
          pacoteData = pacotes.find(p => p.id === pacoteOrcamento.id || p.nome === pacoteOrcamento.nome);
          
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
          }
        }

        const newWorkflowItem: WorkflowItem = {
          id: `orcamento-${orc.id}`,
          data: orc.data,
          hora: orc.hora,
          nome: orc.cliente.nome,
          whatsapp: orc.cliente.telefone,
          email: orc.cliente.email,
          descricao: orc.descricao || orc.detalhes,
          status: 'Fechado',
          categoria: categoriaName,
          pacote: pacoteData ? pacoteData.nome : (orc.pacotes[0]?.nome || ''),
          valorPacote: pacoteData ? 
            (pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || 0) : 
            (orc.pacotes[0]?.preco || 0),
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

        // Adicionar produtos incluídos no pacote
        if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
          const primeiroProduto = pacoteData.produtosIncluidos[0];
          const produtoData = produtos.find(p => p.id === primeiroProduto.produtoId);
          if (produtoData) {
            newWorkflowItem.produto = produtoData.nome;
            newWorkflowItem.qtdProduto = primeiroProduto.quantidade || 1;
            newWorkflowItem.valorTotalProduto = (produtoData.valorVenda || produtoData.preco_venda || 0) * newWorkflowItem.qtdProduto;
          }
        }

        newWorkflowItem.total = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                               newWorkflowItem.valorTotalProduto + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
        newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

        newItems.push(newWorkflowItem);
      }
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
    setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, ...orcamento } : o));
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
    setAppointments(prev => prev.map(app => {
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
    }));
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
                updatedItem.produto = produtoData.nome;
                updatedItem.qtdProduto = primeiroProduto.quantidade || 1;
                updatedItem.valorTotalProduto = (produtoData.valorVenda || produtoData.preco_venda || 0) * updatedItem.qtdProduto;
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

  // Funções de Cartões de Crédito (NOVO)
  const adicionarCartao = (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => {
    const novoCartao = {
      id: Date.now().toString(),
      ...cartao,
      ativo: true
    };
    setCartoes(prev => [...prev, novoCartao]);
    
    toast({
      title: "Cartão adicionado",
      description: `Cartão ${cartao.nome} foi configurado com sucesso.`,
    });
  };

  const atualizarCartao = (id: string, dadosAtualizados: Partial<{ nome: string; diaVencimento: number; diaFechamento: number; ativo: boolean }>) => {
    setCartoes(prev => prev.map(cartao => 
      cartao.id === id ? { ...cartao, ...dadosAtualizados } : cartao
    ));
  };

  const removerCartao = (id: string) => {
    const cartao = cartoes.find(c => c.id === id);
    setCartoes(prev => prev.filter(cartao => cartao.id !== id));
    
    if (cartao) {
      toast({
        title: "Cartão removido",
        description: `Cartão ${cartao.nome} foi removido.`,
        variant: "destructive"
      });
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