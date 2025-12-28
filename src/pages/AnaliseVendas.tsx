import { useState, useEffect } from 'react';
import { SalesMetricsCards } from '@/components/analise-vendas/SalesMetricsCards';
import { SalesChartsGrid } from '@/components/analise-vendas/SalesChartsGrid';
import { SalesGoalsCard } from '@/components/analise-vendas/SalesGoalsCard';
import SalesMonthYearFilter from '@/components/analise-vendas/SalesMonthYearFilter';
import { LeadLossReasonsChart } from '@/components/analise-vendas/LeadLossReasonsChart';
import { SalesInsightsSection } from '@/components/analise-vendas/SalesInsightsSection';
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

  const {
    salesMetrics,
    monthlyData,
    categoryData,
    packageDistributionData,
    originData,
    monthlyOriginData,
    availableYears,
    availableCategories
  } = useSalesAnalytics(selectedYear, selectedMonth, selectedCategory);

  return (
    <div className="min-h-screen bg-lunar-bg">
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
      />

      {/* Main Content - 3 Blocos Visuais */}
      <main className="px-4 md:px-6 py-4 space-y-8">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 1: VISÃO EXECUTIVA                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Visão executiva" className="space-y-4 animate-fade-in">
          {/* KPIs Compactos */}
          <SalesMetricsCards metrics={salesMetrics} />
          
          {/* Metas Horizontais Compactas */}
          <SalesGoalsCard />
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
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BLOCO 3: DIAGNÓSTICO E OPORTUNIDADES                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section aria-label="Diagnóstico e oportunidades" className="space-y-4 animate-fade-in">
          {/* Top Performances e Oportunidades */}
          <SalesInsightsSection />
          
          {/* Leads Perdidos */}
          <LeadLossReasonsChart />
        </section>
      </main>
    </div>
  );
}
