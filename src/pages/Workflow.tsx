import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowTable } from "@/components/workflow/WorkflowTable";
import { ColumnSettings } from "@/components/workflow/ColumnSettings";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
import { useWorkflowRealtime } from "@/hooks/useWorkflowRealtime";
import { useAppointmentWorkflowSync } from "@/hooks/useAppointmentWorkflowSync";
import { useClientesRealtime } from "@/hooks/useClientesRealtime";
import { parseDateFromStorage } from "@/utils/dateUtils";
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
import { WorkflowSyncButton } from '@/components/workflow/WorkflowSyncButton';
import type { SessionData, CategoryOption, PackageOption, ProductOption } from '@/types/workflow';

const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export default function Workflow() {
  const {
    getStatusOptions
  } = useWorkflowStatus();
  const {
    pacotes,
    produtos,
    categorias
  } = useOrcamentoData();
  const {
    sessions: workflowSessions,
    sessionsData,
    loading: workflowLoading,
    error: workflowError,
    updateSession,
    createSessionFromAppointment
  } = useWorkflowRealtime();
  
  const { clientes } = useClientesRealtime();
  
  // Initialize appointment-workflow sync
  useAppointmentWorkflowSync();
  
  const { saveMonthlyMetrics } = useWorkflowMetrics();

  const getClienteByName = (nome: string) => {
    return clientes.find(cliente => cliente.nome === nome);
  };

  // Estado local para UI
  const [sessionDataList, setSessionDataList] = useState<SessionData[]>([]);
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

  // Update sessions from Supabase realtime data using the hook conversion
  useEffect(() => {
    if (!workflowLoading) {
      setSessionDataList(sessionsData);
    }
  }, [sessionsData, workflowLoading]);

  // Mapear dados reais das configurações para formato da tabela
  const categoryOptions: CategoryOption[] = categorias.map((categoria, index) => ({
    id: String(index + 1),
    nome: categoria
  }));
  
  const packageOptions: PackageOption[] = pacotes.map(pacote => ({
    id: pacote.id,
    nome: pacote.nome,
    valor: `R$ ${(pacote.valor_base || 0).toFixed(2).replace('.', ',')}`,
    valorFotoExtra: `R$ ${(pacote.valor_foto_extra || 35).toFixed(2).replace('.', ',')}`,
    categoria: pacote.categoria_id
  }));
  
  const productOptions: ProductOption[] = produtos.map(produto => ({
    id: produto.id,
    nome: produto.nome,
    valor: `R$ ${(produto.preco_venda || 0).toFixed(2).replace('.', ',')}`
  }));

  // Filter sessions by search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessionDataList);
    } else {
      const searchTermNormalized = removeAccents(searchTerm.toLowerCase());
      const filtered = sessionDataList.filter(session => {
        const nomeNormalized = removeAccents(session.nome.toLowerCase());
        const emailNormalized = removeAccents((session.email || '').toLowerCase());
        return nomeNormalized.includes(searchTermNormalized) || 
               emailNormalized.includes(searchTermNormalized);
      });
      setFilteredSessions(filtered);
    }
  }, [searchTerm, sessionDataList]);

  // Filter sessions by current month
  const monthFilteredSessions = useMemo(() => {
    return filteredSessions.filter(session => {
      const sessionDate = parseDateFromStorage(session.data);
      if (!sessionDate) return false;
      return sessionDate.getMonth() + 1 === currentMonth.month && 
             sessionDate.getFullYear() === currentMonth.year;
    });
  }, [filteredSessions, currentMonth]);

  // Navigation functions for months
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(prev => {
      if (prev.month === 1) {
        return { month: 12, year: prev.year - 1 };
      }
      return { month: prev.month - 1, year: prev.year };
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => {
      if (prev.month === 12) {
        return { month: 1, year: prev.year + 1 };
      }
      return { month: prev.month + 1, year: prev.year };
    });
  }, []);

  // Calculate totals for metrics
  const calculateTotal = useCallback((session: SessionData) => {
    const valorPacote = Number(session.valorPacote) || 0;
    const valorFotoExtra = Number(session.valorTotalFotoExtra) || 0;
    const valorProduto = Number(session.valorTotalProduto) || 0;
    const valorAdicional = Number(session.valorAdicional) || 0;
    const desconto = Number(session.desconto) || 0;
    
    return valorPacote + valorFotoExtra + valorProduto + valorAdicional - desconto;
  }, []);

  const calculateRestante = useCallback((session: SessionData) => {
    const total = calculateTotal(session);
    const valorPago = Number(session.valorPago) || 0;
    return total - valorPago;
  }, [calculateTotal]);

  // Financial metrics for current month
  const financials = useMemo(() => {
    const currentMonthTotal = monthFilteredSessions.reduce((acc, session) => acc + calculateTotal(session), 0);
    const currentMonthPaid = monthFilteredSessions.reduce((acc, session) => acc + (Number(session.valorPago) || 0), 0);
    const currentMonthRemaining = monthFilteredSessions.reduce((acc, session) => acc + calculateRestante(session), 0);

    return {
      totalMonth: currentMonthTotal,
      paidMonth: currentMonthPaid,
      remainingMonth: currentMonthRemaining
    };
  }, [monthFilteredSessions, calculateTotal, calculateRestante]);

  // Previous month metrics for comparison
  const prevMonthFinancials = useMemo(() => {
    const prevMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1;
    const prevYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year;
    
    const prevMonthSessions = filteredSessions.filter(session => {
      const sessionDate = parseDateFromStorage(session.data);
      if (!sessionDate) return false;
      return sessionDate.getMonth() + 1 === prevMonth && 
             sessionDate.getFullYear() === prevYear;
    });

    const prevMonthTotal = prevMonthSessions.reduce((acc, session) => acc + calculateTotal(session), 0);
    const prevMonthPaid = prevMonthSessions.reduce((acc, session) => acc + (Number(session.valorPago) || 0), 0);

    return {
      totalMonth: prevMonthTotal,
      paidMonth: prevMonthPaid
    };
  }, [filteredSessions, currentMonth, calculateTotal]);

  // Sort sessions
  const sortedSessions = useMemo(() => {
    if (!sortField) {
      // Ordenação padrão: mais recentes primeiro
      return [...monthFilteredSessions].sort((a, b) => {
        const dateA = parseDateFromStorage(a.data);
        const dateB = parseDateFromStorage(b.data);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
    }

    return [...monthFilteredSessions].sort((a, b) => {
      let aVal = a[sortField as keyof SessionData];
      let bVal = b[sortField as keyof SessionData];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [monthFilteredSessions, sortField, sortDirection]);

  // Format currency
  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  const renderPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    return (
      <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  // Event handlers
  const handleColumnVisibilityChange = useCallback((columnKey: string, visible: boolean) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [columnKey]: visible };
      window.localStorage.setItem('workflow_visible_columns', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleColumnWidthChange = useCallback((widths: Record<string, number>) => {
    setColumnWidths(widths);
    window.localStorage.setItem('workflow_column_widths', JSON.stringify(widths));
  }, []);

  const handleStatusChange = useCallback((sessionId: string, newStatus: string) => {
    updateSession(sessionId, { status: newStatus });
  }, [updateSession]);

  const handleEditSession = useCallback((sessionId: string) => {
    // Implementation for editing session
    console.log('Edit session:', sessionId);
  }, []);

  const handleAddPayment = useCallback((sessionId: string) => {
    // Implementation for adding payment
    console.log('Add payment to session:', sessionId);
  }, []);

  const handleFieldUpdate = useCallback((sessionId: string, field: string, value: any) => {
    updateSession(sessionId, { [field]: value });
  }, [updateSession]);

  const handleSort = useCallback((field: string) => {
    setSortField(field);
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Get month name
  const getMonthName = (month: number) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return monthNames[month - 1];
  };

  if (workflowLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando workflow...</div>
      </div>
    );
  }

  if (workflowError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Erro ao carregar workflow: {String(workflowError)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Workflow</h1>
          <WorkflowSyncButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetrics(!showMetrics)}
          >
            {showMetrics ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showMetrics ? 'Ocultar' : 'Mostrar'} Métricas
          </Button>
        </div>
        <ColumnSettings
          visibleColumns={visibleColumns}
          onColumnVisibilityChange={(columns) => {
            setVisibleColumns(columns);
            window.localStorage.setItem('workflow_visible_columns', JSON.stringify(columns));
          }}
        />
      </div>

      {/* Navigation and Metrics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-lg">
              {getMonthName(currentMonth.month)} {currentMonth.year}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por cliente ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>

        {showMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatCurrency(financials.totalMonth)}</div>
              <div className="text-sm text-muted-foreground">Total do Mês</div>
              {renderPercentageChange(financials.totalMonth, prevMonthFinancials.totalMonth)}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(financials.paidMonth)}</div>
              <div className="text-sm text-muted-foreground">Pago no Mês</div>
              {renderPercentageChange(financials.paidMonth, prevMonthFinancials.paidMonth)}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(financials.remainingMonth)}</div>
              <div className="text-sm text-muted-foreground">A Receber</div>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Table */}
      <div className="border rounded-lg">
        <WorkflowTable
          sessions={sortedSessions}
          statusOptions={getStatusOptions()}
          categoryOptions={categoryOptions}
          packageOptions={packageOptions}
          productOptions={productOptions}
          onStatusChange={handleStatusChange}
          onEditSession={handleEditSession}
          onAddPayment={handleAddPayment}
          onFieldUpdate={handleFieldUpdate}
          visibleColumns={visibleColumns}
          columnWidths={columnWidths}
          onColumnWidthChange={handleColumnWidthChange}
          onScrollChange={setScrollLeft}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}