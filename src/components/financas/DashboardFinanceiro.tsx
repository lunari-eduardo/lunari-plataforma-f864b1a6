import { Card } from '@/components/ui/card';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';
import { memo } from 'react';
import {
  DashboardFilters,
  DashboardKpiCards,
  DashboardGoalsDonuts,
  DashboardChartsBlock,
  EquipmentModalGateway
} from './dashboard';

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
    getNomeMes,
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose
  } = useDashboardFinanceiro();

  return (
    <div className="min-h-screen bg-lunar-bg">
      <div className="p-6 space-y-6 py-0 my-0">
        {/* Hero Section */}
        <section aria-label="Dashboard Header" className="animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 overflow-hidden">
            <div className="relative">
              {/* decorative accents */}
              <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.12]" />
            </div>
          </Card>
        </section>

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