import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';
import { memo } from 'react';
import {
  DashboardFilters,
  DashboardKpiCards,
  DashboardGoalsDonuts,
  DashboardChartsBlock,
  EquipmentModalGateway
} from './dashboard';
import { DashboardGastosBreakdown } from './dashboard/DashboardGastosBreakdown';

const DashboardFinanceiro = memo(function DashboardFinanceiro() {
  const {
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    anosDisponiveis,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    kpisData,
    metasData,
    dadosMensais,
    composicaoDespesas,
    roiData,
    comparisonData,
    startDate,
    endDate,
    getNomeMes,
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose
  } = useDashboardFinanceiro();

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6 py-0 my-0">
        {/* Filtros */}
        <DashboardFilters
          anoSelecionado={anoSelecionado}
          setAnoSelecionado={setAnoSelecionado}
          mesSelecionado={mesSelecionado}
          setMesSelecionado={setMesSelecionado}
          anosDisponiveis={anosDisponiveis}
          getNomeMes={getNomeMes}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicioChange={setDataInicio}
          onDataFimChange={setDataFim}
        />

        {/* KPIs Cards */}
        <DashboardKpiCards
          kpisData={kpisData}
          comparisonData={comparisonData}
        />

        {/* Onda D — Composição de Gastos por Natureza */}
        <DashboardGastosBreakdown
          startDate={startDate}
          endDate={endDate}
        />

        {/* Gráficos Circulares de Metas */}
        <DashboardGoalsDonuts
          metasData={metasData}
        />

        {/* Gráficos com Lazy Loading */}
        <DashboardChartsBlock
          dadosMensais={dadosMensais}
          composicaoDespesas={composicaoDespesas}
          roiData={roiData}
        />
        
        {/* Modal de equipamento */}
        <EquipmentModalGateway
          equipmentModalOpen={equipmentModalOpen}
          equipmentData={equipmentData}
          handleEquipmentModalClose={handleEquipmentModalClose}
        />
      </div>
    </div>
  );
});

export default DashboardFinanceiro;