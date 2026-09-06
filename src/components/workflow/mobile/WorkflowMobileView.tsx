import React, { useState, useCallback, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Filter, ChevronDown, Check, ArrowDown, ArrowUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SessionData, CategoryOption, PackageOption, ProductOption } from "@/types/workflow";
import type { DeleteAction } from "../WorkflowDeleteConfirmModal";
import { WorkflowMobileCard } from "./WorkflowMobileCard";
import {
  formatCurrencyBRL,
  groupSessionsByDate,
} from "./workflowMobileUtils";
import { getMonthName } from "@/features/workflow/components/WorkflowMonthSwitcher";

interface WorkflowMobileViewProps {
  sessions: SessionData[];
  monthSessions: any[];
  currentMonth: { month: number; year: number };
  financials: {
    totalMonth: number;
    paidMonth: number;
    remainingMonth: number;
    creditosGerados?: number;
    creditosUtilizados?: number;
    caixaRecebido?: number;
  };
  isColdMetrics?: boolean;
  isColdSessions?: boolean;
  isRevalidating?: boolean;
  onNavigate: (delta: number | "today") => void;
  onGoToday: () => void;
  filters: {
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    categoryFilter: string;
    setCategoryFilter: (c: string) => void;
    sortField: string;
    setSortField: (f: string) => void;
    sortDirection: "asc" | "desc";
    setSortDirection: (d: "asc" | "desc") => void;
    situacaoFilter: "todos" | "pago" | "pendente";
    setSituacaoFilter: (s: "todos" | "pago" | "pendente") => void;
    situacaoCounts?: { pago: number; pendente: number; total: number };
  };
  categoryOptions: CategoryOption[];
  packageOptions: PackageOption[];
  productOptions: ProductOption[];
  statusOptions: string[];
  actions: {
    handleStatusChange: (id: string, newStatus: string) => void;
    handleEditSession: (id: string) => void;
    handleDeleteSession?: (
      id: string,
      sessionTitle: string,
      paymentCount: number,
      action: DeleteAction,
    ) => void;
    handleFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
    forceRefresh: () => void;
  };
}

export function WorkflowMobileView({
  sessions,
  currentMonth,
  financials,
  isColdMetrics,
  isColdSessions,
  isRevalidating,
  onNavigate,
  onGoToday,
  filters,
  categoryOptions,
  packageOptions,
  productOptions,
  statusOptions,
  actions,
}: WorkflowMobileViewProps) {
  // Apenas 1 card expandido por vez
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  // Agrupamento de sessões por data
  const groupedSessions = useMemo(() => {
    return groupSessionsByDate(sessions);
  }, [sessions]);

  // Se algum filtro está ativo
  const hasActiveFilters =
    Boolean(filters.searchTerm.trim()) ||
    Boolean(filters.categoryFilter) ||
    filters.situacaoFilter !== "todos" ||
    Boolean(filters.sortField);

  const clearAllFilters = useCallback(() => {
    filters.setSearchTerm("");
    filters.setCategoryFilter("");
    filters.setSituacaoFilter("todos");
    filters.setSortField("");
    filters.setSortDirection("asc");
  }, [filters]);

  return (
    <div className="w-full space-y-3.5 px-2.5 pt-1 pb-16">
      {/* 1. CABEÇALHO COM TÍTULO E SUBTÍTULO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Workflow
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suas sessões, tudo sob controle.
          </p>
        </div>
      </div>

      {/* 2. BARRA DE MÉTRICAS COMPACTA */}
      <div className="grid grid-cols-4 gap-2 bg-card/60 dark:bg-card/25 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-2xl p-3 shadow-xs">
        {/* Receita */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
              Receita
            </span>
          </div>
          <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {isColdMetrics ? "..." : formatCurrencyBRL(financials.paidMonth)}
          </span>
        </div>

        {/* Previsto */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
              Previsto
            </span>
          </div>
          <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400 mt-1 truncate">
            {isColdMetrics ? "..." : formatCurrencyBRL(financials.totalMonth)}
          </span>
        </div>

        {/* Pendente */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
              Pendente
            </span>
          </div>
          <span className="text-[13px] font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
            {isColdMetrics ? "..." : formatCurrencyBRL(financials.remainingMonth)}
          </span>
        </div>

        {/* Sessões */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
              Sessões
            </span>
          </div>
          <span className="text-[13px] font-bold text-purple-600 dark:text-purple-400 mt-1 truncate">
            {sessions.length}
          </span>
        </div>
      </div>

      {/* 3. SELETOR DE MÊS COMPACTO */}
      <div className="flex items-center justify-between bg-card/40 dark:bg-card/15 backdrop-blur-md border border-border/30 dark:border-white/10 rounded-xl px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate(-1)}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-semibold text-foreground tracking-tight">
          {getMonthName(currentMonth.month)} {currentMonth.year}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate(1)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onGoToday}
            className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Hoje
          </Button>
        </div>
      </div>

      {/* 4. CAMPO DE BUSCA */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar por cliente ou e-mail..."
          value={filters.searchTerm}
          onChange={(e) => filters.setSearchTerm(e.target.value)}
          className="pl-9 h-10 text-xs rounded-xl bg-card/60 dark:bg-card/25 backdrop-blur-md border-border/40 focus-visible:ring-1 focus-visible:ring-primary/40"
        />
        {filters.searchTerm && (
          <button
            type="button"
            onClick={() => filters.setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 5. CHIPS DE FILTROS E ORDENAÇÃO */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none">
        {/* Filtro Data / Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1 px-2.5 rounded-lg border-border/40 shrink-0",
                filters.sortField === "date" && "bg-primary/10 text-primary border-primary/30",
              )}
            >
              Data
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                filters.setSortField("date");
                filters.setSortDirection("desc");
              }}
            >
              <ArrowDown className="h-3.5 w-3.5 mr-2" />
              Mais recentes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                filters.setSortField("date");
                filters.setSortDirection("asc");
              }}
            >
              <ArrowUp className="h-3.5 w-3.5 mr-2" />
              Mais antigas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filtro Status / Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1 px-2.5 rounded-lg border-border/40 shrink-0",
                filters.sortField === "status" && "bg-primary/10 text-primary border-primary/30",
              )}
            >
              Status
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                filters.setSortField("status");
                filters.setSortDirection("asc");
              }}
            >
              <ArrowUp className="h-3.5 w-3.5 mr-2" />
              A → Z
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                filters.setSortField("status");
                filters.setSortDirection("desc");
              }}
            >
              <ArrowDown className="h-3.5 w-3.5 mr-2" />
              Z → A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filtro Situação Financeira */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1 px-2.5 rounded-lg border-border/40 shrink-0",
                filters.situacaoFilter !== "todos" && "bg-primary/10 text-primary border-primary/30",
              )}
            >
              {filters.situacaoFilter === "pago"
                ? "Pagas"
                : filters.situacaoFilter === "pendente"
                ? "Pendentes"
                : "Situação"}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {(
              [
                { key: "todos", label: "Todas" },
                { key: "pendente", label: "Pendentes" },
                { key: "pago", label: "Pagas" },
              ] as const
            ).map((opt) => {
              const count =
                opt.key === "todos"
                  ? filters.situacaoCounts?.total
                  : opt.key === "pago"
                  ? filters.situacaoCounts?.pago
                  : filters.situacaoCounts?.pendente;
              return (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => filters.setSituacaoFilter(opt.key)}
                  className="flex items-center justify-between"
                >
                  <span>
                    {opt.label}
                    {typeof count === "number" && (
                      <span className="ml-1 text-muted-foreground text-[11px]">
                        ({count})
                      </span>
                    )}
                  </span>
                  {filters.situacaoFilter === opt.key && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filtro Categoria */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1 px-2.5 rounded-lg border-border/40 shrink-0",
                filters.categoryFilter && "bg-primary/10 text-primary border-primary/30",
              )}
            >
              <Filter className="h-3 w-3 opacity-60" />
              {filters.categoryFilter || "Categoria"}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => filters.setCategoryFilter("")}>
              Todas as categorias
            </DropdownMenuItem>
            {categoryOptions.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onClick={() => filters.setCategoryFilter(cat.nome)}
              >
                {cat.nome}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground shrink-0"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* 6. LISTA DE SESSÕES AGRUPADAS POR DATA */}
      {isColdSessions ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3 bg-card/30 dark:bg-card/10 rounded-2xl border border-dashed border-border/40">
          <div className="text-muted-foreground">
            <p className="text-sm font-medium">Nenhuma sessão encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filters.searchTerm
                ? "Tente ajustar o termo de busca"
                : filters.situacaoFilter !== "todos"
                ? `Nenhuma sessão ${filters.situacaoFilter === "pago" ? "paga" : "pendente"} neste mês`
                : "Não há sessões agendadas para este mês"}
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-1">
            <Button onClick={onGoToday} variant="outline" size="sm" className="h-8 text-xs">
              Ir para mês atual
            </Button>
            <Button onClick={() => actions.forceRefresh()} variant="outline" size="sm" className="h-8 text-xs">
              Recarregar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 pt-1">
          {groupedSessions.map((group) => (
            <div key={group.dateKey} className="space-y-2.5">
              {/* CABEÇALHO DO GRUPO DE DATA */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground tracking-tight">
                  {group.displayDate}
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {group.sessions.length}{" "}
                  {group.sessions.length === 1 ? "sessão" : "sessões"}
                </span>
              </div>

              {/* LISTA DE CARDS DAQUELE DIA */}
              <div className="space-y-2.5">
                {group.sessions.map((session) => (
                  <WorkflowMobileCard
                    key={session.id}
                    session={session}
                    isExpanded={expandedCardId === session.id}
                    onToggleExpand={() => handleToggleExpand(session.id)}
                    statusOptions={statusOptions}
                    packageOptions={packageOptions}
                    productOptions={productOptions}
                    onStatusChange={actions.handleStatusChange}
                    onFieldUpdate={actions.handleFieldUpdate}
                    onDeleteSession={actions.handleDeleteSession}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
