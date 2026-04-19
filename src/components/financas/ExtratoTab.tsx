import React, { useState } from 'react';
import { useExtrato } from '@/hooks/useExtrato';
import { Search, TrendingUp, Wallet, CalendarDays } from 'lucide-react';
import FinanceFilters from '@/components/financas/shared/FinanceFilters';
import ExtratoSummaryCards from '@/components/extrato/ExtratoSummaryCards';
import ExtratoTable from '@/components/extrato/ExtratoTable';
import DemonstrativoSection from '@/components/extrato/DemonstrativoSection';
import { SegmentedControl, SegmentOption } from '@/components/ui/segmented-control';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

const VIEW_OPTIONS: SegmentOption[] = [
  { value: 'detalhado', label: 'Vista Detalhada', icon: Search },
  { value: 'demonstrativo', label: 'Demonstrativo', icon: TrendingUp },
];

const REGIME_OPTIONS: SegmentOption[] = [
  { value: 'caixa', label: 'Caixa', icon: Wallet },
  { value: 'competencia', label: 'Competência', icon: CalendarDays },
];

export default function ExtratoTab() {
  const {
    linhas,
    resumo,
    demonstrativo,
    filtros,
    paginacao,
    isLoading,
    regime,
    setRegime,
    atualizarFiltros,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  const [activeView, setActiveView] = useState('detalhado');

  return (
    <div className="space-y-6">
      {/* Header com toggle de regime */}
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-muted-foreground">
          Visão unificada de todas as movimentações financeiras
        </p>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Sobre regimes contábeis"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                <p className="font-medium mb-1">Regime Contábil</p>
                <p className="mb-1">
                  <strong>Caixa:</strong> considera a data em que o dinheiro
                  efetivamente entrou ou saiu (fluxo de caixa real).
                </p>
                <p>
                  <strong>Competência:</strong> considera a data da prestação
                  do serviço ou da despesa (desempenho do período).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <SegmentedControl
            options={REGIME_OPTIONS}
            value={regime}
            onValueChange={(v) => setRegime(v as 'caixa' | 'competencia')}
          />
        </div>
      </div>

      {/* Unified Filters */}
      <FinanceFilters 
        variant="extrato"
        dataInicio={filtros.dataInicio}
        dataFim={filtros.dataFim}
        onDataInicioChange={(v) => atualizarFiltros({ dataInicio: v })}
        onDataFimChange={(v) => atualizarFiltros({ dataFim: v })}
        tipo={filtros.tipo}
        onTipoChange={(v) => atualizarFiltros({ tipo: v as any })}
        origem={filtros.origem}
        onOrigemChange={(v) => atualizarFiltros({ origem: v as any })}
        status={filtros.status}
        onStatusChange={(v) => atualizarFiltros({ status: v as any })}
        busca={filtros.busca}
        onBuscaChange={(v) => atualizarFiltros({ busca: v })}
        onLimparFiltros={limparFiltros}
      />

      {/* Summary Cards */}
      <ExtratoSummaryCards resumo={resumo} regime={regime} />

      {/* Segmented Control for Views */}
      <div className="flex justify-center">
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={activeView}
          onValueChange={setActiveView}
        />
      </div>

      {/* Content based on active view */}
      <div className="mt-6">
        {activeView === 'detalhado' && (
          <ExtratoTable 
            linhas={linhas}
            onAbrirOrigem={abrirOrigem}
            dadosExportacao={prepararDadosExportacao()}
            paginacao={paginacao}
            isLoading={isLoading}
            regime={regime}
          />
        )}
        
        {activeView === 'demonstrativo' && (
          <DemonstrativoSection 
            demonstrativo={demonstrativo} 
            periodo={{
              inicio: filtros.dataInicio,
              fim: filtros.dataFim
            }}
            regime={regime}
          />
        )}
      </div>
    </div>
  );
}
