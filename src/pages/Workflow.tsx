import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { WorkflowTable } from "@/components/workflow/WorkflowTable";
import { WorkflowFilters } from "@/components/workflow/WorkflowFilters";
import { ManualPaymentModal } from "@/components/workflow/ManualPaymentModal";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { useOrcamentoData } from "@/hooks/useOrcamentoData";
import { useWorkflowPackageData } from "@/hooks/useWorkflowPackageData";
import { useClientesRealtime } from "@/hooks/useClientesRealtime";
import { usePricingMigration } from "@/hooks/usePricingMigration";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useWorkflowMonthSessions } from "@/features/workflow/hooks/useWorkflowMonthSessions";
import { useWorkflowFilters } from "@/features/workflow/hooks/useWorkflowFilters";
import { useWorkflowColumns } from "@/features/workflow/hooks/useWorkflowColumns";
import { useWorkflowSessionActions } from "@/features/workflow/hooks/useWorkflowSessionActions";
import { WorkflowMetricsBar } from "@/features/workflow/components/WorkflowMetricsBar";
import {
  WorkflowMonthSwitcher,
  getMonthName,
} from "@/features/workflow/components/WorkflowMonthSwitcher";
import { WorkflowTasksDock } from "@/features/workflow/components/WorkflowTasksDock";

import type { CategoryOption, PackageOption, ProductOption } from "@/types/workflow";

export default function Workflow() {
  return (
    <ErrorBoundary label="Workflow">
      <WorkflowContent />
    </ErrorBoundary>
  );
}

function WorkflowContent() {
  // ── Dados de referência ─────────────────────────────────────────────
  const { getStatusOptions } = useWorkflowStatus();
  const { pacotes, produtos, categorias } = useOrcamentoData();
  const { convertSessionToData } = useWorkflowPackageData();
  useClientesRealtime();
  usePricingMigration();

  // ── Sessões do mês + navegação ──────────────────────────────────────
  const month = useWorkflowMonthSessions();
  const sessionsData = useMemo(
    () => month.workflowSessions.map((s) => convertSessionToData(s)),
    [month.workflowSessions, convertSessionToData],
  );

  // ── Ações (mutações) ────────────────────────────────────────────────
  const actions = useWorkflowSessionActions({
    workflowSessions: month.workflowSessions,
    setWorkflowSessions: month.setWorkflowSessions,
    mergeUpdate: month.mergeUpdate,
    removeSessionFromCache: month.removeSessionFromCache,
    forceRefresh: month.forceRefresh,
    ensureMonthLoaded: month.ensureMonthLoaded,
    currentMonth: month.currentMonth,
  });

  // ── Filtros, busca, ordenação ───────────────────────────────────────
  const filters = useWorkflowFilters(sessionsData, month.workflowSessions);

  // ── Colunas ─────────────────────────────────────────────────────────
  const columns = useWorkflowColumns();
  const [, setScrollLeft] = useState(0);

  // ── UI state ────────────────────────────────────────────────────────
  const [showMetrics, setShowMetrics] = useState(true);
  const [isTasksPanelOpen, setIsTasksPanelOpen] = usePersistedState(
    "workflow_tasks_panel_open",
    true,
  );

  // ── Mapeamento de opções ────────────────────────────────────────────
  const categoryOptions: CategoryOption[] = categorias.map((cat, i) => ({
    id: String(i + 1),
    nome: cat,
  }));
  const packageOptions: PackageOption[] = pacotes.map((p) => ({
    id: p.id,
    nome: p.nome,
    valor: `R$ ${(Number(p.valor_base) || 0).toFixed(2).replace(".", ",")}`,
    valorFotoExtra: `R$ ${(Number(p.valor_foto_extra) || 35).toFixed(2).replace(".", ",")}`,
    categoria: p.categoria_id,
  }));
  const productOptions: ProductOption[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    valor: `R$ ${(Number(p.preco_venda) || 0).toFixed(2).replace(".", ",")}`,
  }));

  // ── Métricas financeiras (dados crus do banco) ──────────────────────
  const financials = useMemo(() => {
    const previsto = month.workflowSessions.reduce(
      (sum, s) => sum + (Number(s.valor_total) || 0),
      0,
    );
    const receita = month.workflowSessions.reduce(
      (sum, s) => sum + (Number(s.valor_pago) || 0),
      0,
    );
    return {
      totalMonth: previsto,
      paidMonth: receita,
      remainingMonth: previsto - receita,
    };
  }, [month.workflowSessions]);

  // ── Estados de loading/erro globais ────────────────────────────────
  if ((month.loading || month.isLoadingCurrentMonth) && month.workflowSessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">
            Carregando sessões de {getMonthName(month.currentMonth.month)} {month.currentMonth.year}...
          </p>
        </div>
      </div>
    );
  }

  if (month.error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-destructive">Erro ao carregar workflow: {String(month.error)}</div>
        <Button onClick={() => month.forceRefresh()} variant="outline">
          Recarregar dados
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex-1 min-w-0 space-y-4 transition-all duration-300 ${
          isTasksPanelOpen ? "lg:pr-[340px]" : "lg:pr-12"
        }`}
      >
        <WorkflowMetricsBar
          showMetrics={showMetrics}
          onToggle={setShowMetrics}
          financials={financials}
          sessionCount={filters.filteredSessions.length}
        />

        <WorkflowMonthSwitcher
          month={month.currentMonth.month}
          year={month.currentMonth.year}
          isPreloading={month.isPreloading}
          onPrev={month.goPrev}
          onNext={month.goNext}
          onToday={month.goToday}
        />

        <div className="rounded-lg bg-card/30 backdrop-blur-xl dark:bg-card/[0.04] border border-white/50 dark:border-white/10">
          <div className="flex items-center justify-between p-3 border-b gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por cliente ou e-mail..."
                value={filters.searchTerm}
                onChange={(e) => filters.setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <WorkflowFilters
              sortField={filters.sortField}
              sortDirection={filters.sortDirection}
              onSortChange={(field, dir) => {
                filters.setSortField(field);
                filters.setSortDirection(dir);
              }}
              categoryFilter={filters.categoryFilter}
              onCategoryFilterChange={filters.setCategoryFilter}
              categoryOptions={categoryOptions}
              situacaoFilter={filters.situacaoFilter}
              onSituacaoFilterChange={filters.setSituacaoFilter}
              situacaoCounts={filters.situacaoCounts}
            />
          </div>

          {filters.sortedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="text-muted-foreground text-center">
                <div className="text-lg font-medium">Nenhuma sessão encontrada</div>
                <div className="text-sm">
                  {filters.searchTerm
                    ? "Tente ajustar o termo de busca"
                    : filters.situacaoFilter !== "todos"
                      ? `Nenhuma sessão ${filters.situacaoFilter === "pago" ? "paga" : "pendente"} em ${getMonthName(month.currentMonth.month)} ${month.currentMonth.year}`
                      : `Não há sessões para ${getMonthName(month.currentMonth.month)} ${month.currentMonth.year}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={month.goToday} variant="outline" size="sm">
                  Ir para mês atual
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  Recarregar dados
                </Button>
              </div>
            </div>
          ) : (
            <WorkflowTable
              sessions={filters.sortedSessions}
              statusOptions={getStatusOptions}
              categoryOptions={categoryOptions}
              packageOptions={packageOptions}
              productOptions={productOptions}
              onStatusChange={actions.handleStatusChange}
              onEditSession={actions.handleEditSession}
              onAddPayment={actions.handleAddPayment}
              onDeleteSession={actions.handleDeleteSession}
              onFieldUpdate={actions.handleFieldUpdate}
              visibleColumns={columns.visibleColumns}
              columnWidths={columns.columnWidths}
              onColumnWidthChange={columns.handleColumnWidthChange}
              onScrollChange={setScrollLeft}
              sortField={filters.sortField}
              sortDirection={filters.sortDirection}
              onSort={filters.handleSort}
            />
          )}
        </div>
      </div>

      <WorkflowTasksDock
        isOpen={isTasksPanelOpen}
        onOpen={() => setIsTasksPanelOpen(true)}
        onClose={() => setIsTasksPanelOpen(false)}
        currentMonth={month.currentMonth}
      />

      <ManualPaymentModal
        isOpen={actions.manualPaymentSessionId !== null}
        onClose={actions.handleManualPaymentClose}
        sessionId={actions.manualPaymentSessionId}
        onSuccess={actions.handleManualPaymentSuccess}
      />
    </div>
  );
}
