import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowTable } from "@/components/workflow/WorkflowTable";
import { QuickSessionAdd } from "@/components/workflow/QuickSessionAdd";
import { ColumnSettings } from "@/components/workflow/ColumnSettings";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
import { useWorkflowCache } from "@/contexts/WorkflowCacheContext";
import { useWorkflowPackageData } from "@/hooks/useWorkflowPackageData";
import { useAppointmentWorkflowSync } from "@/hooks/useAppointmentWorkflowSync";
import { useClientesRealtime } from "@/hooks/useClientesRealtime";
import { useSessionsRealtime } from "@/hooks/useSessionsRealtime";
import { useWorkflowRealtime } from '@/hooks/useWorkflowRealtime';
import { parseDateFromStorage } from "@/utils/dateUtils";
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
import { useWorkflowMetricsRealtime } from '@/hooks/useWorkflowMetricsRealtime';
import { WorkflowSyncButton } from '@/components/workflow/WorkflowSyncButton';
import { usePricingMigration } from '@/hooks/usePricingMigration';
import { Snowflake } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { SessionData, CategoryOption, PackageOption, ProductOption } from '@/types/workflow';
import type { WorkflowSession } from '@/hooks/useWorkflowRealtime';

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
  
  // Estado local para UI - MOVER ANTES dos hooks que dependem dele
  const [currentMonth, setCurrentMonth] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  
  // ⚡ NOVO: Usar Context Provider com cache IndexedDB
  const {
    getSessionsForMonthSync,
    isPreloading,
    subscribe,
    mergeUpdate,
    forceRefresh
  } = useWorkflowCache();
  
  // Use package data resolution hook para conversão
  const { convertSessionToData } = useWorkflowPackageData();
  
  // Estado para sessões do cache
  const [workflowSessions, setWorkflowSessions] = useState<WorkflowSession[]>(() => {
    // Tentativa INSTANTÂNEA de carregar do cache
    return getSessionsForMonthSync(currentMonth.year, currentMonth.month) || [];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe para updates do cache
  useEffect(() => {
    const unsubscribe = subscribe((allSessions) => {
      // Filtrar pelo mês atual
      const filtered = allSessions.filter(s => {
        const date = new Date(s.data_sessao);
        return date.getFullYear() === currentMonth.year && 
               date.getMonth() + 1 === currentMonth.month;
      });
      setWorkflowSessions(filtered);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [currentMonth, subscribe]);
  
  // Converter sessões para SessionData usando o hook de conversão
  const sessionsData = useMemo(() => {
    return workflowSessions.map(session => convertSessionToData(session));
  }, [workflowSessions, convertSessionToData]);
  
  // Use sessions hook for manual session creation
  const { createManualSession } = useSessionsRealtime();
  const { updateSession: updateSessionRealtime } = useWorkflowRealtime();
  
  // Funções de edição (integradas com Context) - FASE 1, 2 e 4
  const updateSession = useCallback(async (sessionId: string, updates: Partial<WorkflowSession>, silent = false) => {
    try {
      const currentSession = workflowSessions.find(s => s.id === sessionId);
      if (!currentSession) {
        throw new Error('Sessão não encontrada');
      }
      
      // FASE 4: Validação - Remover campos read-only antes do update
      const validUpdates = { ...updates };
      if ((validUpdates as any).clientes) {
        console.warn('⚠️ Campo "clientes" removido (read-only)');
        delete (validUpdates as any).clientes;
      }
      if ((validUpdates as any).pagamentos) {
        console.warn('⚠️ Campo "pagamentos" removido (read-only)');
        delete (validUpdates as any).pagamentos;
      }
      if (validUpdates.created_at) {
        console.warn('⚠️ Campo "created_at" removido (read-only)');
        delete validUpdates.created_at;
      }
      
      // 1. Optimistic update no cache com dados validados
      mergeUpdate({ ...currentSession, ...validUpdates });
      
      // 2. FASE 2: Usar função robusta do hook (já sanitiza e recongela)
      await updateSessionRealtime(sessionId, validUpdates, silent);
      
    } catch (error) {
      console.error('Error updating session:', error);
      // Reverter update otimista em caso de erro
      await forceRefresh();
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
      throw error;
    }
  }, [workflowSessions, mergeUpdate, forceRefresh, updateSessionRealtime]);
  
  const deleteWorkflowSession = useCallback(async (sessionId: string, deletePayments: boolean) => {
    try {
      // Delete session do Supabase
      const { error: deleteError } = await supabase
        .from('clientes_sessoes')
        .delete()
        .eq('id', sessionId);
      
      if (deleteError) throw deleteError;
      
      toast({
        title: "Sessão excluída",
        description: "A sessão foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a sessão.",
        variant: "destructive",
      });
    }
  }, []);
  
  const { clientes } = useClientesRealtime();
  
  // Initialize appointment-workflow sync
  useAppointmentWorkflowSync();
  
  // Initialize pricing migration for existing sessions
  usePricingMigration();

  const getClienteByName = (nome: string) => {
    return clientes.find(cliente => cliente.nome === nome);
  };

  // Estado local para UI
  const [sessionDataList, setSessionDataList] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);
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

  // Update sessions from cache data
  useEffect(() => {
    if (sessionsData) {
      setSessionDataList(sessionsData);
    }
  }, [sessionsData]);

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
        const nomeNormalized = removeAccents((session.nome || '').toLowerCase());
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

  // ✅ MÉTRICAS EM TEMPO REAL DO SUPABASE
  const workflowMetrics = useWorkflowMetricsRealtime(
    currentMonth.year,
    currentMonth.month
  );

  // Calculate totals for metrics (mantido para compatibilidade com outras funções)
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

  // ✅ Financial metrics usando dados em tempo real do Supabase
  const financials = useMemo(() => {
    return {
      totalMonth: workflowMetrics.previsto,
      paidMonth: workflowMetrics.receita,
      remainingMonth: workflowMetrics.aReceber
    };
  }, [workflowMetrics]);

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

  // Helper: Map header keys to SessionData properties
  const getFieldMapping = useCallback((headerKey: string): keyof SessionData => {
    const mapping: Record<string, keyof SessionData> = {
      'client': 'nome',
      'date': 'data',
      'status': 'status',
      'category': 'categoria',
      'package': 'pacote',
      'extraPhotoQty': 'qtdFotosExtra',
      'productTotal': 'valorTotalProduto',
      'total': 'total', // Calculated field
      'remaining': 'restante', // Calculated field
      'paid': 'valorPago'
    };
    return (mapping[headerKey] || headerKey) as keyof SessionData;
  }, []);

  // Helper: Get sortable value (handles dates, currency, calculated fields)
  const getSortValue = useCallback((session: SessionData, headerKey: string): string | number => {
    const field = getFieldMapping(headerKey);
    
    // Handle calculated fields
    if (headerKey === 'total') {
      return calculateTotal(session);
    }
    if (headerKey === 'remaining') {
      return calculateRestante(session);
    }
    
    // Handle dates - convert to timestamp
    if (headerKey === 'date' || field === 'data') {
      const dateObj = parseDateFromStorage(session.data);
      return dateObj ? dateObj.getTime() : 0;
    }
    
    // Handle currency fields - convert to number
    const currencyFields = ['valorPago', 'valorTotalProduto', 'valorPacote', 'desconto', 'valorAdicional'];
    if (currencyFields.includes(field as string)) {
      const value = session[field];
      if (typeof value === 'string') {
        return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      }
      return Number(value) || 0;
    }
    
    // Handle quantity fields
    if (headerKey === 'extraPhotoQty' || field === 'qtdFotosExtra') {
      return Number(session.qtdFotosExtra) || 0;
    }
    
    // Handle text fields
    const value = session[field];
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    
    return value || '';
  }, [getFieldMapping, calculateTotal, calculateRestante]);

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
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [monthFilteredSessions, sortField, sortDirection, getSortValue]);

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

  const handleDeleteSession = useCallback((sessionId: string, sessionTitle: string, paymentCount: number) => {
    // For now, delete without including payments (user can choose via modal)
    deleteWorkflowSession(sessionId, false);
  }, [deleteWorkflowSession]);

  const handleFieldUpdate = useCallback((sessionId: string, field: string, value: any, silent: boolean = false) => {
    return updateSession(sessionId, { [field]: value }, silent);
  }, [updateSession]);

  const handleSort = useCallback((field: string) => {
    setSortField(prevField => {
      // Se mudou de coluna, começar com 'asc'
      if (prevField !== field) {
        setSortDirection('asc');
        return field;
      }
      // Mesma coluna: alternar direção
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  // Handle quick session add
  const handleQuickSessionAdd = useCallback(async (data: any) => {
    try {
      await createManualSession(data);
      // Real-time will update the list automatically
    } catch (error) {
      console.error('Erro ao criar sessão rápida:', error);
    }
  }, [createManualSession]);

  // FASE 4: Recongelar todas as sessões manualmente
  const recongelarTodasSessoes = useCallback(async () => {
    try {
      toast({
        title: "Recongelando dados...",
        description: "Processando todas as sessões. Isso pode levar alguns segundos.",
      });

      const { pricingFreezingService } = await import('@/services/PricingFreezingService');
      const result = await pricingFreezingService.migrarSessoesExistentes();
      
      toast({
        title: "✅ Recongelamento concluído",
        description: `${result.migrated} sessões recongeladas com sucesso!`,
      });
      
      // Recarregar sessões
      window.location.reload();
    } catch (error) {
      console.error('❌ Erro ao recongelar sessões:', error);
      toast({
        title: "Erro ao recongelar",
        description: "Ocorreu um erro ao recongelar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
  }, []);

  // Get month name
  const getMonthName = (month: number) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return monthNames[month - 1];
  };

  if (loading && workflowSessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando workflow...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-destructive">Erro ao carregar workflow: {String(error)}</div>
        <Button onClick={() => forceRefresh()} variant="outline">
          Recarregar dados
        </Button>
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
            onClick={recongelarTodasSessoes}
            className="gap-2"
          >
            <Snowflake className="w-4 h-4" />
            Recongelar Dados
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              forceRefresh();
              toast({
                title: "Cache limpo",
                description: "Recarregando dados do servidor...",
              });
            }}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Cache
          </Button>
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
          {isPreloading && (
            <Badge variant="outline" className="ml-2">
              ⏳ Atualizando...
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth({
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear()
            })}
          >
            Hoje
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground font-medium mb-2">RECEITA</div>
              <div className="text-2xl font-bold text-green-400">{formatCurrency(financials.paidMonth)}</div>
              {renderPercentageChange(financials.paidMonth, prevMonthFinancials.paidMonth)}
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground font-medium mb-2">PREVISTO</div>
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(financials.totalMonth)}</div>
              {renderPercentageChange(financials.totalMonth, prevMonthFinancials.totalMonth)}
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground font-medium mb-2">A RECEBER</div>
              <div className="text-2xl font-bold text-orange-400">{formatCurrency(financials.remainingMonth)}</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-sm text-muted-foreground font-medium mb-2">SESSÕES</div>
              <div className="text-2xl font-bold">{monthFilteredSessions.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-muted p-4 rounded-lg text-sm">
          <h3 className="font-bold mb-2">Debug Info:</h3>
          <div>Total sessions: {workflowSessions?.length || 0}</div>
          <div>Session data list: {sessionDataList?.length || 0}</div>
          <div>Filtered sessions: {filteredSessions?.length || 0}</div>
          <div>Month filtered sessions: {monthFilteredSessions?.length || 0}</div>
          <div>Sorted sessions: {sortedSessions?.length || 0}</div>
          <div>Current month: {getMonthName(currentMonth.month)} {currentMonth.year}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Error: {error ? String(error) : 'None'}</div>
        </div>
      )}

      {/* Workflow Table */}
      <div className="border rounded-lg">
        {/* Quick Add Session - Always visible */}
        <div className="p-4 border-b">
          <QuickSessionAdd onSubmit={handleQuickSessionAdd} />
        </div>

        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-muted-foreground text-center">
              <div className="text-lg font-medium">Nenhuma sessão encontrada</div>
              <div className="text-sm">
                {searchTerm ? 'Tente ajustar o termo de busca' : `Não há sessões para ${getMonthName(currentMonth.month)} ${currentMonth.year}`}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setCurrentMonth({
                  month: new Date().getMonth() + 1,
                  year: new Date().getFullYear()
                })}
                variant="outline"
                size="sm"
              >
                Ir para mês atual
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Recarregar dados
              </Button>
            </div>
          </div>
        ) : (
          <WorkflowTable
            sessions={sortedSessions}
            statusOptions={getStatusOptions}
            categoryOptions={categoryOptions}
            packageOptions={packageOptions}
            productOptions={productOptions}
            onStatusChange={handleStatusChange}
            onEditSession={handleEditSession}
            onAddPayment={handleAddPayment}
            onDeleteSession={handleDeleteSession}
            onFieldUpdate={handleFieldUpdate}
            visibleColumns={visibleColumns}
            columnWidths={columnWidths}
            onColumnWidthChange={handleColumnWidthChange}
            onScrollChange={setScrollLeft}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>
    </div>
  );
}