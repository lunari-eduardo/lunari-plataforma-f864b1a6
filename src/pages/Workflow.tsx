import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WorkflowFilter, FilterOptions } from "@/components/workflow/WorkflowFilter";
import { WorkflowTable } from "@/components/workflow/WorkflowTable";
import { ColumnSettings } from "@/components/workflow/ColumnSettings";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAgenda } from "@/hooks/useAgenda";
import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { parseDateFromStorage } from "@/utils/dateUtils";
import { FixPricingRulesButton } from '@/components/workflow/FixPricingRulesButton';
import { applyFakeAppointments } from '@/utils/createFakeAppointments';

interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

interface SessionPayment {
  id: string;
  valor: number;
  data: string;
  forma_pagamento?: string;
  observacoes?: string;
}
interface SessionData {
  id: string;
  data: string;
  hora: string;
  nome: string;
  email: string;
  descricao: string;
  status: string;
  whatsapp: string;
  categoria: string;
  pacote: string;
  valorPacote: string;
  valorFotoExtra: string;
  qtdFotosExtra: number;
  valorTotalFotoExtra: string;
  produto: string;
  qtdProduto: number;
  valorTotalProduto: string;
  valorAdicional: string;
  detalhes: string;
  observacoes: string;
  valor: string;
  total: string;
  valorPago: string;
  restante: string;
  desconto: number;
  pagamentos?: SessionPayment[];
  produtosList?: ProdutoWorkflow[];
  // Novos campos para orçamentos ajustados
  valorFinalAjustado?: boolean;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
}
interface CategoryOption {
  id: string;
  nome: string;
}
interface PackageOption {
  id: string;
  nome: string;
  valor: string;
  valorFotoExtra: string;
  categoria: string;
}
interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}
const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
export default function Workflow() {
  const {
    toast
  } = useToast();
  const {
    getConfirmedSessionsForWorkflow
  } = useAgenda();
  const {
    getStatusOptions
  } = useWorkflowStatus();
  const {
    clientes,
    addAppointment
  } = useContext(AppContext);
  const {
    pacotes,
    produtos,
    categorias
  } = useOrcamentoData();
  
  // Função para criar agendamentos fictícios
  const handleCreateFakeAppointments = () => {
    console.log('🎯 Botão clicado! Iniciando criação de agendamentos fictícios...');
    console.log('addAppointment function:', addAppointment);
    
    // Teste básico primeiro
    alert('Botão foi clicado!');
    
    try {
      const createdAppointments = applyFakeAppointments(addAppointment);
      console.log('✅ Agendamentos criados:', createdAppointments);
      
      toast({
        title: "Agendamentos Criados",
        description: `${createdAppointments.length} agendamentos fictícios foram criados para junho, julho e agosto de 2024.`,
      });
    } catch (error) {
      console.error('❌ Erro ao criar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar agendamentos fictícios. Verifique o console.",
        variant: "destructive"
      });
    }
  };
  
  const getClienteByName = (nome: string) => {
    return clientes.find(cliente => cliente.nome === nome);
  };

  // Carregamento dos status de workflow das configurações - apenas etapas personalizadas
  const statusOptions = getStatusOptions();

  // Carregamento inicial dos dados do localStorage
  const [sessions, setSessions] = useState<SessionData[]>(() => {
    try {
      const savedSessions = window.localStorage.getItem('workflow_sessions');
      return savedSessions ? JSON.parse(savedSessions) : [];
    } catch (error) {
      console.error("Erro ao carregar sessões do localStorage", error);
      return [];
    }
  });
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);
  const [currentMonth, setCurrentMonth] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [sortField, setSortField] = useState<string>(''); // Vazio para usar ordenação padrão
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [scrollLeft, setScrollLeft] = useState(0);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = window.localStorage.getItem('workflow_column_widths');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error("Erro ao carregar larguras das colunas", error);
      return {};
    }
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = window.localStorage.getItem('workflow_visible_columns');
      return saved ? JSON.parse(saved) : {
        date: true,
        client: true,
        description: true,
        email: true,
        status: true,
        category: true,
        package: true,
        packageValue: true,
        discount: true,
        extraPhotoValue: true,
        extraPhotoQty: true,
        extraPhotoTotal: true,
        product: true,
        productTotal: true,
        additionalValue: true,
        details: true,
        total: true,
        paid: true,
        remaining: true,
        payment: true
      };
    } catch (error) {
      console.error("Erro ao carregar colunas visíveis", error);
      return {
        date: true,
        client: true,
        description: true,
        email: true,
        status: true,
        category: true,
        package: true,
        packageValue: true,
        discount: true,
        extraPhotoValue: true,
        extraPhotoQty: true,
        extraPhotoTotal: true,
        product: true,
        productTotal: true,
        additionalValue: true,
        details: true,
        total: true,
        paid: true,
        remaining: true,
        payment: true
      };
    }
  });

  // Persistência automática das alterações - salvar sempre que sessions mudar
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        // Sempre fazer merge com dados existentes para não perder outras alterações
        const allSavedSessions = JSON.parse(window.localStorage.getItem('workflow_sessions') || '[]');
        
        // Criar um novo array com merge inteligente
        const mergedSessions = [...allSavedSessions];
        
        sessions.forEach(currentSession => {
          const existingIndex = mergedSessions.findIndex(s => s.id === currentSession.id);
          if (existingIndex >= 0) {
            // Atualizar dados existentes
            mergedSessions[existingIndex] = currentSession;
          } else {
            // Adicionar nova sessão
            mergedSessions.push(currentSession);
          }
        });
        
        window.localStorage.setItem('workflow_sessions', JSON.stringify(mergedSessions));
        console.log('Workflow sessions saved to localStorage:', sessions.length, 'sessions');
      } catch (error) {
        console.error("Erro ao salvar sessões no localStorage", error);
      }
    }
  }, [sessions]);
  // Mapear dados reais das configurações para formato da tabela
  const categoryOptions: CategoryOption[] = categorias.map((categoria, index) => ({
    id: String(index + 1),
    nome: categoria
  }));
  const packageOptions: PackageOption[] = pacotes.map(pacote => ({
    id: pacote.id,
    nome: pacote.nome,
    valor: `R$ ${pacote.valor.toFixed(2).replace('.', ',')}`,
    valorFotoExtra: `R$ ${(pacote.valorFotoExtra || 35).toFixed(2).replace('.', ',')}`,
    categoria: pacote.categoria
  }));
  const productOptions: ProductOption[] = produtos.map(produto => ({
    id: produto.id,
    nome: produto.nome,
    valor: `R$ ${produto.valorVenda.toFixed(2).replace('.', ',')}`
  }));
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessions);
    } else {
      const searchTermNormalized = removeAccents(searchTerm.toLowerCase());
      const filtered = sessions.filter(session => removeAccents(session.nome.toLowerCase()).includes(searchTermNormalized) || removeAccents(session.email.toLowerCase()).includes(searchTermNormalized) || removeAccents(session.descricao.toLowerCase()).includes(searchTermNormalized));
      setFilteredSessions(filtered);
    }
  }, [sessions, searchTerm]);

  // Integração com dados reais da agenda - carregar sessões do mês selecionado
  useEffect(() => {
    console.log('Loading workflow data for month:', currentMonth);
    
    const confirmedSessions = getConfirmedSessionsForWorkflow(currentMonth.month, currentMonth.year, getClienteByName, pacotes, produtos);

    // Carregar todas as sessões salvas do localStorage
    const allSavedSessions = (() => {
      try {
        const saved = window.localStorage.getItem('workflow_sessions');
        const result = saved ? JSON.parse(saved) : [];
        console.log('Loaded saved sessions from localStorage:', result.length, 'total sessions');
        return result;
      } catch (error) {
        console.error("Erro ao carregar sessões salvas", error);
        return [];
      }
    })();

    // Filtrar sessões salvas que pertencem ao mês atual (preservar TODAS as edições)
    const existingSessionsForCurrentMonth = allSavedSessions.filter((session: SessionData) => {
      const sessionDate = parseDateFromStorage(session.data);
      return sessionDate.getUTCMonth() + 1 === currentMonth.month && sessionDate.getUTCFullYear() === currentMonth.year;
    });

    console.log('Found existing sessions for current month:', existingSessionsForCurrentMonth.length);

    // Mapear agendamentos confirmados, preservando dados editados ou criando novos
    const currentMonthSessions: SessionData[] = confirmedSessions.map(agendamento => {
      const existingSession = existingSessionsForCurrentMonth.find((s: SessionData) => s.id === agendamento.id);
      if (existingSession) {
        console.log('Using existing session data for:', agendamento.id);
        return existingSession;
      } else {
        console.log('Creating new session data for:', agendamento.id);
        return {
          ...agendamento,
          status: '',
          detalhes: ''
        };
      }
    });
    
    console.log('Setting sessions for current month:', currentMonthSessions.length, 'sessions');
    setSessions(currentMonthSessions);
  }, [currentMonth, getConfirmedSessionsForWorkflow, getClienteByName, pacotes, produtos]);
  const handlePreviousMonth = () => {
    let newMonth = currentMonth.month - 1;
    let newYear = currentMonth.year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setCurrentMonth({
      month: newMonth,
      year: newYear
    });
  };
  const handleNextMonth = () => {
    let newMonth = currentMonth.month + 1;
    let newYear = currentMonth.year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setCurrentMonth({
      month: newMonth,
      year: newYear
    });
  };
  const getCurrentMonthName = () => {
    const date = new Date(currentMonth.year, currentMonth.month - 1);
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  };
  const toggleMetrics = () => {
    setShowMetrics(!showMetrics);
  };

  // Calcular métricas em tempo real do mês selecionado
  const financials = useMemo(() => {
    const currentMonthSessions = filteredSessions;
    const totalRevenue = currentMonthSessions.reduce((sum, session) => {
      const paidStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
      const paid = parseFloat(paidStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + paid;
    }, 0);
    const totalForecasted = currentMonthSessions.reduce((sum, session) => {
      const totalStr = typeof session.total === 'string' ? session.total : String(session.total || '0');
      const total = parseFloat(totalStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + total;
    }, 0);
    const totalOutstanding = currentMonthSessions.reduce((sum, session) => {
      const remainingStr = typeof session.restante === 'string' ? session.restante : String(session.restante || '0');
      const remaining = parseFloat(remainingStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + remaining;
    }, 0);
    return {
      revenue: totalRevenue,
      forecasted: totalForecasted,
      outstanding: totalOutstanding,
      sessionCount: currentMonthSessions.length
    };
  }, [filteredSessions]);

  // Métricas do mês anterior para comparação
  const prevMonthFinancials = useMemo(() => {
    const prevMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1;
    const prevYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year;
    const allSavedSessions = (() => {
      try {
        const saved = window.localStorage.getItem('workflow_sessions');
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        return [];
      }
    })();
    const prevMonthSessions = allSavedSessions.filter((session: SessionData) => {
      const sessionDate = parseDateFromStorage(session.data);
      return sessionDate.getUTCMonth() + 1 === prevMonth && sessionDate.getUTCFullYear() === prevYear;
    });
    const prevRevenue = prevMonthSessions.reduce((sum: number, session: SessionData) => {
      const paidStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
      const paid = parseFloat(paidStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + paid;
    }, 0);
    const prevForecasted = prevMonthSessions.reduce((sum: number, session: SessionData) => {
      const totalStr = typeof session.total === 'string' ? session.total : String(session.total || '0');
      const total = parseFloat(totalStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + total;
    }, 0);
    const prevOutstanding = prevMonthSessions.reduce((sum: number, session: SessionData) => {
      const remainingStr = typeof session.restante === 'string' ? session.restante : String(session.restante || '0');
      const remaining = parseFloat(remainingStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + remaining;
    }, 0);
    return {
      revenue: prevRevenue,
      forecasted: prevForecasted,
      outstanding: prevOutstanding,
      sessionCount: prevMonthSessions.length
    };
  }, [currentMonth]);
  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2
  })}`;
  const renderChange = (current: number, previous: number) => {
    const change = (current - previous) / previous * 100;
    const isPositive = change > 0;
    return <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
      </span>;
  };
  const handleFilterChange = (filters: any) => {
    if (filters.search !== undefined) {
      setSearchTerm(filters.search);
    }
  };
  const handleResetFilters = () => {
    setSearchTerm('');
  };
  const handleColumnVisibilityChange = (cols: any) => {
    setVisibleColumns(cols);
    // Persistir configurações de colunas visíveis
    try {
      window.localStorage.setItem('workflow_visible_columns', JSON.stringify(cols));
    } catch (error) {
      console.error("Erro ao salvar configurações de colunas", error);
    }
  };
  const handleColumnWidthChange = (widths: Record<string, number>) => {
    setColumnWidths(widths);
    // Persistir larguras das colunas
    try {
      window.localStorage.setItem('workflow_column_widths', JSON.stringify(widths));
    } catch (error) {
      console.error("Erro ao salvar larguras das colunas", error);
    }
  };
  const handleStatusChange = (id: string, status: string) => {
    setSessions(prev => prev.map(s => s.id === id ? {
      ...s,
      status
    } : s));
  };
  const handleEditSession = (id: string) => {
    console.log('Edit session:', id);
  };
  const handleAddPayment = (id: string) => {
    console.log('Add payment:', id);
  };

  // Função de atualização corrigida
  const handleFieldUpdate = useCallback((id: string, field: string, value: any) => {
    setSessions(prev => prev.map(session => session.id === id ? {
      ...session,
      [field]: value
    } : session));
  }, []);

  const sortedSessions = useMemo(() => {
    // Função auxiliar para criar timestamp a partir de data + hora
    const createTimestamp = (data: string, hora: string) => {
      const [day, month, year] = data.split('/').map(Number);
      const [hours, minutes] = hora.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes).getTime();
    };

    // SEMPRE aplicar ordenação cronológica crescente por padrão (quando não há sortField)
    if (!sortField) {
      return [...filteredSessions].sort((a, b) => {
        const timestampA = createTimestamp(a.data, a.hora);
        const timestampB = createTimestamp(b.data, b.hora);
        return timestampA - timestampB; // Sempre cronológico crescente por padrão
      });
    }

    // Quando há sortField, aplica ordenação solicitada
    return [...filteredSessions].sort((a, b) => {
      // Mapeamento de campos da interface para campos do SessionData
      const fieldMapping: Record<string, keyof SessionData> = {
        'date': 'data',
        'client': 'nome',
        'status': 'status',
        'category': 'categoria',
        'package': 'pacote',
        'packageValue': 'valorPacote',
        'discount': 'desconto',
        'extraPhotoQty': 'qtdFotosExtra',
        'extraPhotoTotal': 'valorTotalFotoExtra',
        'product': 'produto',
        'productTotal': 'valorTotalProduto',
        'additionalValue': 'valorAdicional',
        'total': 'total',
        'paid': 'valorPago',
        'remaining': 'restante'
      };

      let aValue: any, bValue: any;

      // Handle different data types
      if (sortField === 'date') {
        // Para ordenação manual de data, usar a mesma lógica da ordenação padrão
        aValue = createTimestamp(a.data, a.hora);
        bValue = createTimestamp(b.data, b.hora);
      } else {
        const actualField = fieldMapping[sortField] || sortField as keyof SessionData;
        aValue = a[actualField];
        bValue = b[actualField];

        if (['packageValue', 'discount', 'extraPhotoTotal', 'productTotal', 'additionalValue', 'total', 'paid', 'remaining'].includes(sortField)) {
          aValue = parseFloat(String(aValue).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          bValue = parseFloat(String(bValue).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        } else if (sortField === 'extraPhotoQty') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredSessions, sortField, sortDirection]);
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Se clicando no mesmo campo, alterna direção ou remove ordenação
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Remove ordenação para voltar à ordenação padrão
        setSortField('');
        setSortDirection('asc');
      }
    } else {
      // Se clicando em campo diferente, define o campo e começa em crescente
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);
  return <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 pt-3 bg-lunar-bg">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[180px] text-center">
              {getCurrentMonthName()}
            </div>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCreateFakeAppointments}
              className="text-green-700 border-green-600 hover:bg-green-50"
            >
              📅 Criar Agendamentos Fictícios
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleMetrics} className="flex items-center space-x-2 text-gray-600">
              {showMetrics ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{showMetrics ? "Ocultar" : "Métricas"}</span>
            </Button>
          </div>
        </div>

        {showMetrics && <div className="px-4 pt-2 pb-3 bg-lunar-bg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-xs text-green-700 font-medium">Receita</div>
                <div className="text-lg font-bold text-green-800">{formatCurrency(financials.revenue)}</div>
                {renderChange(financials.revenue, prevMonthFinancials.revenue)}
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-700 font-medium">Previsto</div>
                <div className="text-lg font-bold text-blue-800">{formatCurrency(financials.forecasted)}</div>
                {renderChange(financials.forecasted, prevMonthFinancials.forecasted)}
              </div>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <div className="text-xs text-orange-700 font-medium">A Receber</div>
                <div className="text-lg font-bold text-orange-800">{formatCurrency(financials.outstanding)}</div>
                {renderChange(financials.outstanding, prevMonthFinancials.outstanding)}
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-700 font-medium">Sessões</div>
                <div className="text-lg font-bold text-purple-800">{financials.sessionCount}</div>
                {renderChange(financials.sessionCount, prevMonthFinancials.sessionCount)}
              </div>
            </div>
          </div>}

        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-2 bg-lunar-surface">
          <div className="flex items-center space-x-2 flex-1 bg-lunar-bg">
            <div className="relative max-w-xs flex-1 bg-lunar-bg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por cliente (sem acentos)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-9 bg-neutral-50" />
            </div>
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-zinc-700 bg-neutral-50">Limpar</Button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 hidden md:inline">
              Mostrando {filteredSessions.length} sessões
            </span>
            <ColumnSettings visibleColumns={visibleColumns} onColumnVisibilityChange={handleColumnVisibilityChange} availableColumns={{
            date: "Data e Hora",
            client: "Cliente",
            description: "Descrição",
            email: "E-mail",
            status: "Status",
            category: "Categoria",
            package: "Pacote",
            packageValue: "Valor Pacote",
            discount: "Desconto",
            extraPhotoValue: "Valor Foto",
            extraPhotoQty: "Qtd Foto",
            extraPhotoTotal: "Total Foto",
            product: "Produto",
            productTotal: "Total Produto",
            additionalValue: "Adicional",
            details: "Obs",
            total: "Total",
            paid: "Pago",
            remaining: "Restante",
            payment: "Pagamento"
          }} />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <WorkflowTable sessions={sortedSessions} statusOptions={statusOptions} categoryOptions={categoryOptions} packageOptions={packageOptions} productOptions={productOptions} onStatusChange={handleStatusChange} onEditSession={handleEditSession} onAddPayment={handleAddPayment} onFieldUpdate={handleFieldUpdate} visibleColumns={visibleColumns} columnWidths={columnWidths} onColumnWidthChange={handleColumnWidthChange} onScrollChange={setScrollLeft} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
      </div>
    </div>;
}