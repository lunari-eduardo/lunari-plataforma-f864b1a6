import type { ChartsBlockProps } from './types';
import GraficosFinanceiros from '@/components/financas/GraficosFinanceiros';

export function DashboardChartsBlock({ dadosMensais, composicaoDespesas, roiData }: ChartsBlockProps) {
  return (
    <section aria-label="Gráficos" className="animate-fade-in">
      <div className="space-y-6">
        <GraficosFinanceiros
          dadosMensais={dadosMensais}
          composicaoDespesas={composicaoDespesas}
          roiData={roiData}
        />
      </div>
    </section>
  );
}