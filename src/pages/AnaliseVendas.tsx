import { useState, useEffect, useMemo } from 'react';
import { SalesMetricsCards } from '@/components/analise-vendas/SalesMetricsCards';
import { SalesChartsGrid } from '@/components/analise-vendas/SalesChartsGrid';
import { SalesGoalsCard } from '@/components/analise-vendas/SalesGoalsCard';
import SalesMonthYearFilter from '@/components/analise-vendas/SalesMonthYearFilter';
import { LeadLossReasonsChart } from '@/components/analise-vendas/LeadLossReasonsChart';
import { SalesInsightsSection } from '@/components/analise-vendas/SalesInsightsSection';
import { SalesYearComparisonBlock } from '@/components/analise-vendas/SalesYearComparisonBlock';
import { ProductionMetricsCards } from '@/components/analise-vendas/ProductionMetricsCards';
import { ProductionByMonthChart } from '@/components/analise-vendas/ProductionByMonthChart';
import { useSalesAnalytics } from '@/hooks/useSalesAnalyticsWrapper';
import { useWorkflowPhotoProduction } from '@/hooks/useWorkflowPhotoProduction';

export default function AnaliseVendas() {
  // SEO basics
  useEffect(() => {
    const desc = "Análise completa de vendas: receita mensal, sessões realizadas, ticket médio, conversão, distribuição por categoria e origem dos leads.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Comparison state
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonYear, setComparisonYear] = useState<number | null>(null);
  // null = automatic (current month or last month with data)
  const [comparisonLimitMonth, setComparisonLimitMonth] = useState<number | null>(null);

  // Auto-suggest previous year when toggling comparison or changing base year
  const effectiveComparisonYear = useMemo(() => {
    if (!comparisonEnabled) return null;
    if (comparisonYear && comparisonYear !== selectedYear) return comparisonYear;
    return selectedYear - 1;
  }, [comparisonEnabled, comparisonYear, selectedYear]);

  const {
    salesMetrics,
    monthlyData,
    categoryData,
    packageDistributionData,
    originData,
    monthlyOriginData,
    availableYears,
    availableCategories,
    comparison
  } = useSalesAnalytics(selectedYear, selectedMonth, selectedCategory, {
    enabled: comparisonEnabled,
    comparisonYear: effectiveComparisonYear,
    limitMonth: comparisonLimitMonth
  });

  // Effective limit month (resolved by repository, falls back to current month for current year, or 11)
  const effectiveLimitMonth = useMemo(() => {
    if (comparison) return comparison.limitMonth;
    if (selectedYear === currentYear) return new Date().getMonth();
    return 11;
  }, [comparison, selectedYear, currentYear]);

  // Reset manual limit when toggling comparison off so "Auto" reappears next time
  useEffect(() => {
    if (!comparisonEnabled) setComparisonLimitMonth(null);
  }, [comparisonEnabled]);

  // Produção fotográfica (fotos inclusas no pacote + extras)
  const photoProd = useWorkflowPhotoProduction({
    year: selectedYear,
    // selectedMonth vem 0-based (0=Jan). null => ano inteiro.
    month: selectedMonth === null || selectedMonth === undefined ? undefined : (selectedMonth as number) + 1,
    categoria: selectedCategory === 'all' ? null : selectedCategory,
  });

  const productionSummary = useMemo(() => {
    const isAnnual = selectedMonth === null || selectedMonth === undefined;
    const src: any = isAnnual ? photoProd.annual : photoProd.single;
    const fotosTotal = src?.fotosTotal ?? 0;
    const fotosIncluidas = src?.fotosIncluidas ?? 0;
    const fotosExtras = src?.fotosExtras ?? 0;
    const sessoesComPacote = src?.sessoesComPacote ?? 0;
    const sessoesSemPacote = src?.sessoesSemPacote ?? 0;
    const totalSessoes = sessoesComPacote + sessoesSemPacote;
    const mediaFotosPorSessao = src?.mediaFotosPorSessao ?? (totalSessoes > 0 ? fotosTotal / totalSessoes : 0);
    // Categoria líder: mensal traz categoriaTop direto; anual agrega a partir das mensais
    let categoriaTop: string | null = src?.categoriaTop ?? null;
    let fotosCategoriaTop: number = src?.fotosCategoriaTop ?? 0;
    if (isAnnual && photoProd.monthly?.length) {
      const acc = new Map<string, number>();
      for (const m of photoProd.monthly) {
        if (!m.categoriaTop) continue;
        acc.set(m.categoriaTop, (acc.get(m.categoriaTop) ?? 0) + (m.fotosCategoriaTop ?? 0));
      }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) {
        categoriaTop = top[0];
        fotosCategoriaTop = top[1];
      }
    }
    return {
      fotosTotal,
      fotosIncluidas,
      fotosExtras,
      sessoesComPacote,
      sessoesSemPacote,
      mediaFotosPorSessao,
      categoriaTop,
      fotosCategoriaTop,
    };
  }, [photoProd.annual, photoProd.single, photoProd.monthly, selectedMonth]);

  const scopeLabel = selectedMonth === null || selectedMonth === undefined ? 'no ano' : 'no mês';

  return (
    <div className="min-h-screen">
      {/* Filtros Sticky - Compactos */}
      <SalesMonthYearFilter 
        selectedYear={selectedYear} 
        selectedMonth={selectedMonth} 
        selectedCategory={selectedCategory} 
        availableYears={availableYears} 
        availableCategories={availableCategories} 
        onYearChange={setSelectedYear} 
        onMonthChange={setSelectedMonth} 
        onCategoryChange={setSelectedCategory}
        comparisonEnabled={comparisonEnabled}
        comparisonYear={effectiveComparisonYear}
        onComparisonEnabledChange={(enabled) => {
          setComparisonEnabled(enabled);
          if (enabled && !comparisonYear) {
            setComparisonYear(selectedYear - 1);
          }
        }}
        onComparisonYearChange={setComparisonYear}
        comparisonLimitMonth={comparisonLimitMonth}
        effectiveLimitMonth={effectiveLimitMonth}
        onComparisonLimitMonthChange={setComparisonLimitMonth}
      />

      {/* Main Content - 3 Blocos Visuais */}
      <main className="px-5 md:px-7 py-5 space-y-9 text-[1.05rem]">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 1: VISÃO EXECUTIVA                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Visão executiva" className="space-y-4 animate-fade-in">
          {/* KPIs Compactos com comparação */}
          <SalesMetricsCards 
            metrics={salesMetrics} 
            comparison={comparison ? { metrics: comparison.metrics, comparisonYear: comparison.comparisonYear } : null}
          />
          
          {/* Metas Horizontais Compactas */}
          <SalesGoalsCard 
            selectedYear={selectedYear} 
            selectedMonth={selectedMonth} 
            selectedCategory={selectedCategory}
            currentRevenue={salesMetrics.totalRevenue}
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 2: ANÁLISE DE DESEMPENHO                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Análise de desempenho" className="space-y-4 animate-fade-in">
          <SalesChartsGrid 
            monthlyData={monthlyData} 
            categoryData={categoryData} 
            packageDistributionData={packageDistributionData} 
            originData={originData} 
            monthlyOriginData={monthlyOriginData} 
            selectedCategory={selectedCategory}
            comparison={comparison}
            baseYear={selectedYear}
          />

          {/* Bloco de comparação anual detalhado */}
          {comparison && (
            <SalesYearComparisonBlock comparison={comparison} baseYear={selectedYear} />
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 2.5: PRODUÇÃO FOTOGRÁFICA                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Produção fotográfica" className="space-y-4 animate-fade-in">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Produção fotográfica</h2>
            <p className="text-xs text-muted-foreground">
              Fotos previstas para entrega: inclusas no pacote + extras compradas na galeria (ou manuais).
            </p>
          </div>
          <ProductionMetricsCards
            fotosTotal={productionSummary.fotosTotal}
            fotosIncluidas={productionSummary.fotosIncluidas}
            fotosExtras={productionSummary.fotosExtras}
            mediaFotosPorSessao={productionSummary.mediaFotosPorSessao}
            categoriaTop={productionSummary.categoriaTop}
            fotosCategoriaTop={productionSummary.fotosCategoriaTop}
            sessoesComPacote={productionSummary.sessoesComPacote}
            sessoesSemPacote={productionSummary.sessoesSemPacote}
            isLoading={photoProd.isLoading}
            scopeLabel={scopeLabel}
          />
          <ProductionByMonthChart monthly={photoProd.monthly} isLoading={photoProd.isLoading} />
        </section>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 3: DIAGNÓSTICO E OPORTUNIDADES                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Diagnóstico e oportunidades" className="space-y-4 animate-fade-in">
          {/* Top Performances */}
          <SalesInsightsSection 
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedCategory={selectedCategory}
          />
          
          {/* Leads Perdidos */}
          <LeadLossReasonsChart />
        </section>
      </main>
    </div>
  );
}
