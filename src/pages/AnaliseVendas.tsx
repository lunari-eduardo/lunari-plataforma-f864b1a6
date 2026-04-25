import { useState, useEffect, useMemo } from 'react';
import { SalesMetricsCards } from '@/components/analise-vendas/SalesMetricsCards';
import { SalesChartsGrid } from '@/components/analise-vendas/SalesChartsGrid';
import { SalesGoalsCard } from '@/components/analise-vendas/SalesGoalsCard';
import SalesMonthYearFilter from '@/components/analise-vendas/SalesMonthYearFilter';
import { LeadLossReasonsChart } from '@/components/analise-vendas/LeadLossReasonsChart';
import { SalesInsightsSection } from '@/components/analise-vendas/SalesInsightsSection';
import { SalesYearComparisonBlock } from '@/components/analise-vendas/SalesYearComparisonBlock';
import { useSalesAnalytics } from '@/hooks/useSalesAnalyticsWrapper';

export default function AnaliseVendas() {
  // SEO basics
  useEffect(() => {
    const title = "Análise de Vendas | Dashboard de Performance";
    document.title = title;
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
