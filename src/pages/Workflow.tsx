import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "use-debounce";
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
import { AppContext, WorkflowItem } from '@/contexts/AppContext';
import { parseDateFromStorage } from "@/utils/dateUtils";
import { FixPricingRulesButton } from '@/components/workflow/FixPricingRulesButton';


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
  
  
  const getClienteByName = useCallback((nome: string) => {
    return clientes.find(cliente => cliente.nome === nome);
  }, [clientes]);

  // Carregamento dos status de workflow das configurações - apenas etapas personalizadas
  const statusOptions = getStatusOptions();

  // NOVA ARQUITETURA: Usar workflowItems diretamente do AppContext (fonte única)
  const { workflowItems, updateWorkflowItem } = useContext(AppContext);
  
  // Estado local para sessões do mês atual (filtradas do workflowItems)
  const [sessions, setSessions] = useState<SessionData[]>([]);
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

  // NOVA ARQUITETURA: Persistência através do AppContext apenas
  const saveSessionToWorkflow = useCallback((sessionData: SessionData) => {
    try {
      // Converter SessionData para WorkflowItem
      const parseValue = (value: string | number): number => {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        const cleanValue = value.toString().replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(cleanValue) || 0;
      };

      const workflowUpdate: Partial<WorkflowItem> = {
        data: sessionData.data,
        hora: sessionData.hora,
        nome: sessionData.nome,
        whatsapp: sessionData.whatsapp,
        email: sessionData.email,
        descricao: sessionData.descricao,
        status: sessionData.status,
        categoria: sessionData.categoria,
        pacote: sessionData.pacote,
        valorPacote: parseValue(sessionData.valorPacote),
        desconto: sessionData.desconto,
        valorFotoExtra: parseValue(sessionData.valorFotoExtra),
        qtdFotoExtra: sessionData.qtdFotosExtra,
        valorTotalFotoExtra: parseValue(sessionData.valorTotalFotoExtra),
        produto: sessionData.produto,
        qtdProduto: sessionData.qtdProduto,
        valorTotalProduto: parseValue(sessionData.valorTotalProduto),
        produtosList: sessionData.produtosList || [],
        valorAdicional: parseValue(sessionData.valorAdicional),
        detalhes: sessionData.detalhes,
        total: parseValue(sessionData.total),
        valorPago: parseValue(sessionData.valorPago),
        restante: parseValue(sessionData.restante),
        pagamentos: sessionData.pagamentos || []
      };

      updateWorkflowItem(sessionData.id, workflowUpdate);
      console.log('💾 Session synced to AppContext:', sessionData.id);
    } catch (error) {
      console.error('❌ Erro ao sincronizar session com AppContext:', error);
    }
  }, [updateWorkflowItem]);
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

  // Implementar debounce e controle de loading para evitar loops
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounce do currentMonth para evitar chamadas excessivas
  const [debouncedCurrentMonth] = useDebounce(currentMonth, 300);

  // Integração com dados reais da agenda - carregar sessões do mês selecionado
  useEffect(() => {
    if (isLoading) return; // Evitar múltiplas execuções simultâneas
    
    setIsLoading(true);
    console.log('📅 Loading workflow for:', `${debouncedCurrentMonth.month}/${debouncedCurrentMonth.year}`);
    
    // Limpar timeout anterior se existir
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // Executar com delay mínimo para evitar spam
    loadingTimeoutRef.current = setTimeout(() => {
      try {
        const confirmedSessions = getConfirmedSessionsForWorkflow(debouncedCurrentMonth.month, debouncedCurrentMonth.year, getClienteByName);

        // NOVA ARQUITETURA: Usar workflowItems como fonte única
        const workflowItemsDoMes = workflowItems.filter(item => {
          const itemDate = new Date(item.data);
          return itemDate.getMonth() + 1 === debouncedCurrentMonth.month && 
                 itemDate.getFullYear() === debouncedCurrentMonth.year;
        });

        console.log('📊 WorkflowItems do mês:', workflowItemsDoMes.length);

        // Converter WorkflowItems para SessionData e mapear agendamentos confirmados
        const currentMonthSessions: SessionData[] = confirmedSessions.map(agendamento => {
          // Procurar dados existentes no workflowItems
          const existingWorkflowItem = workflowItemsDoMes.find(item => item.id === agendamento.id);
          
          if (existingWorkflowItem) {
            // Converter WorkflowItem para SessionData
            return {
              id: existingWorkflowItem.id,
              data: existingWorkflowItem.data,
              hora: existingWorkflowItem.hora,
              nome: existingWorkflowItem.nome,
              email: existingWorkflowItem.email,
              descricao: existingWorkflowItem.descricao,
              status: existingWorkflowItem.status,
              whatsapp: existingWorkflowItem.whatsapp,
              categoria: existingWorkflowItem.categoria,
              pacote: existingWorkflowItem.pacote,
              valorPacote: String(existingWorkflowItem.valorPacote || 0),
              valorFotoExtra: String(existingWorkflowItem.valorFotoExtra || 0),
              qtdFotosExtra: existingWorkflowItem.qtdFotoExtra || 0,
              valorTotalFotoExtra: String(existingWorkflowItem.valorTotalFotoExtra || 0),
              produto: existingWorkflowItem.produto || '',
              qtdProduto: existingWorkflowItem.qtdProduto || 0,
              valorTotalProduto: String(existingWorkflowItem.valorTotalProduto || 0),
              valorAdicional: String(existingWorkflowItem.valorAdicional || 0),
              detalhes: existingWorkflowItem.detalhes || '',
              observacoes: '',
              valor: String(existingWorkflowItem.total || 0),
              total: String(existingWorkflowItem.total || 0),
              valorPago: String(existingWorkflowItem.valorPago || 0),
              restante: String(existingWorkflowItem.restante || 0),
              desconto: existingWorkflowItem.desconto || 0,
              pagamentos: existingWorkflowItem.pagamentos || [],
              produtosList: existingWorkflowItem.produtosList || []
            };
           } else {
             // Novo agendamento sem dados do workflow
             return {
               ...agendamento,
               status: '',
               detalhes: '',
               observacoes: ''
             };
           }
        });
    
        setSessions(currentMonthSessions);
        console.log('✅ Workflow data loaded:', currentMonthSessions.length, 'sessions');
      } catch (error) {
        console.error('Erro ao carregar dados do workflow:', error);
      } finally {
        setIsLoading(false);
      }
    }, 100); // Delay mínimo para debounce

    // Cleanup
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      setIsLoading(false);
    };
  }, [debouncedCurrentMonth, getConfirmedSessionsForWorkflow, getClienteByName]);
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

  // Funções de cálculo dinâmico (mesmas usadas na tabela)
  const calculateTotal = useCallback((session: SessionData) => {
    try {
      const valorPacoteStr = typeof session.valorPacote === 'string' ? session.valorPacote : String(session.valorPacote || '0');
      const valorPacote = parseFloat(valorPacoteStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorFotoExtraStr = typeof session.valorTotalFotoExtra === 'string' ? session.valorTotalFotoExtra : String(session.valorTotalFotoExtra || '0');
      const valorFotoExtra = parseFloat(valorFotoExtraStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const valorAdicionalStr = typeof session.valorAdicional === 'string' ? session.valorAdicional : String(session.valorAdicional || '0');
      const valorAdicional = parseFloat(valorAdicionalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const desconto = session.desconto || 0;

      // Apenas produtos manuais somam ao total
      let valorProdutosManuais = 0;
      if (session.produtosList && session.produtosList.length > 0) {
        const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
        valorProdutosManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
      } else if (session.valorTotalProduto) {
        const valorProdutoStr = typeof session.valorTotalProduto === 'string' ? session.valorTotalProduto : String(session.valorTotalProduto || '0');
        valorProdutosManuais = parseFloat(valorProdutoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      }
      const totalCalculado = valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto;
      return totalCalculado;
    } catch (error) {
      console.error('Erro no cálculo de total:', error);
      return 0;
    }
  }, []);

  const calculateRestante = useCallback((session: SessionData) => {
    const total = calculateTotal(session);
    const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
    const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    return total - valorPago;
  }, [calculateTotal]);

  // Calcular métricas em tempo real do mês selecionado (ignora filtros)
  const financials = useMemo(() => {
    // Usar sessions (já filtradas do workflowItems)
    const currentMonthSessions = sessions;
    const totalRevenue = currentMonthSessions.reduce((sum, session) => {
      const paidStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
      const paid = parseFloat(paidStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
      return sum + paid;
    }, 0);

    // USAR CÁLCULO DINÂMICO para Previsto (ao invés de session.total)
    const totalForecasted = currentMonthSessions.reduce((sum, session) => {
      return sum + calculateTotal(session);
    }, 0);

    // USAR CÁLCULO DINÂMICO para A Receber (ao invés de session.restante)  
    const totalOutstanding = currentMonthSessions.reduce((sum, session) => {
      return sum + calculateRestante(session);
    }, 0);

    return {
      revenue: totalRevenue,
      forecasted: totalForecasted,
      outstanding: totalOutstanding,
      sessionCount: currentMonthSessions.length
    };
  }, [sessions, calculateTotal, calculateRestante]);

  // Métricas do mês anterior para comparação
  const prevMonthFinancials = useMemo(() => {
    const prevMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1;
    const prevYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year;
    // NOVA ARQUITETURA: Usar workflowItems para mês anterior
    const prevMonthSessions = workflowItems.filter(item => {
      const itemDate = new Date(item.data);
      return itemDate.getMonth() + 1 === prevMonth && itemDate.getFullYear() === prevYear;
    });
    const prevRevenue = prevMonthSessions.reduce((sum: number, item: WorkflowItem) => {
      return sum + (item.valorPago || 0);
    }, 0);
    const prevForecasted = prevMonthSessions.reduce((sum: number, item: WorkflowItem) => {
      return sum + (item.total || 0);
    }, 0);
    const prevOutstanding = prevMonthSessions.reduce((sum: number, item: WorkflowItem) => {
      return sum + (item.restante || 0);
    }, 0);
    return {
      revenue: prevRevenue,
      forecasted: prevForecasted,
      outstanding: prevOutstanding,
      sessionCount: prevMonthSessions.length
    };
  }, [currentMonth, workflowItems]);
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