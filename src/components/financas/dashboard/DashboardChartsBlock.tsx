import { lazy, Suspense } from 'react';
import type { ChartsBlockProps } from './types';

// Lazy loading para gráficos pesados
const GraficosFinanceiros = lazy(() => import('@/components/financas/GraficosFinanceiros'));

export function DashboardChartsBlock({ dadosMensais, composicaoDespesas, roiData }: ChartsBlockProps) {
  return (
    <section aria-label="Gráficos" className="animate-fade-in">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      }>
        <div className="space-y-6">
          <GraficosFinanceiros
            dadosMensais={dadosMensais}
            composicaoDespesas={composicaoDespesas}
            roiData={roiData}
          />
        </div>
      </Suspense>
    </section>
  );
}