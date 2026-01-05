import React, { useState } from 'react';
import { useExtrato } from '@/hooks/useExtrato';
import { Search, TrendingUp } from 'lucide-react';
import FinanceFilters from '@/components/financas/shared/FinanceFilters';
import ExtratoSummaryCards from '@/components/extrato/ExtratoSummaryCards';
import ExtratoTable from '@/components/extrato/ExtratoTable';
import DemonstrativoSection from '@/components/extrato/DemonstrativoSection';
import { SegmentedControl, SegmentOption } from '@/components/ui/segmented-control';

const VIEW_OPTIONS: SegmentOption[] = [
  { value: 'detalhado', label: 'Vista Detalhada', icon: Search },
  { value: 'demonstrativo', label: 'Demonstrativo', icon: TrendingUp },
];

export default function ExtratoTab() {
  const {
    linhas,
    resumo,
    demonstrativo,
    filtros,
    paginacao,
    isLoading,
    atualizarFiltros,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  const [activeView, setActiveView] = useState('detalhado');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2">
        <p className="text-muted-foreground">
          Visão unificada de todas as movimentações financeiras
        </p>
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
      <ExtratoSummaryCards resumo={resumo} />

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
          />
        )}
        
        {activeView === 'demonstrativo' && (
          <DemonstrativoSection 
            demonstrativo={demonstrativo} 
            periodo={{
              inicio: filtros.dataInicio,
              fim: filtros.dataFim
            }}
          />
        )}
      </div>
    </div>
  );
}
