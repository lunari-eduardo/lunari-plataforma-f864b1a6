import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target } from 'lucide-react';
import { SalesMetricsCards } from '@/components/analise-vendas/SalesMetricsCards';
import { SalesChartsGrid } from '@/components/analise-vendas/SalesChartsGrid';
import SalesMonthYearFilter from '@/components/analise-vendas/SalesMonthYearFilter';
import { LeadLossReasonsChart } from '@/components/analise-vendas/LeadLossReasonsChart';
import SalesAnalysisHero from '@/components/analise-vendas/SalesAnalysisHero';
import { useSalesAnalytics } from '@/hooks/useSalesAnalytics';
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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = all months, 0-11 = specific month
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
      {/* Sticky Header */}
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

      {/* Main Content */}
      <main className="space-y-6 p-4 md:p-6">
        {/* Hero Section */}
        <section aria-label="Visão geral da análise de vendas" className="animate-fade-in">
          <SalesAnalysisHero
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedCategory={selectedCategory}
            totalRevenue={salesMetrics.totalRevenue}
            totalSessions={salesMetrics.totalSessions}
            conversionRate={salesMetrics.conversionRate}
            availableCategories={availableCategories}
          />
        </section>

        {/* Metrics Cards */}
        <section aria-label="Métricas principais" className="animate-fade-in">
          <SalesMetricsCards metrics={salesMetrics} />
        </section>

        {/* Charts Grid */}
        <section aria-label="Gráficos de análise" className="animate-fade-in">
          <SalesChartsGrid 
            monthlyData={monthlyData} 
            categoryData={categoryData} 
            packageDistributionData={packageDistributionData} 
            originData={originData} 
            monthlyOriginData={monthlyOriginData} 
            selectedCategory={selectedCategory} 
          />
        </section>

        {/* Lead Loss Reasons */}
        <section aria-label="Análise de motivos de perda" className="animate-fade-in">
          <LeadLossReasonsChart />
        </section>

        {/* Additional Insights */}
        <section aria-label="Insights adicionais" className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
                <div className="p-2 rounded-lg bg-brand-gradient">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                Top Performances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Melhor Mês</p>
                  <p className="text-xs text-lunar-textSecondary">Novembro 2024</p>
                </div>
                <Badge variant="secondary" className="text-2xs">+45%</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Melhor Serviço</p>
                  <p className="text-xs text-lunar-textSecondary">Ensaio Casal</p>
                </div>
                <Badge variant="secondary" className="text-2xs">R$ 15.2k</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Cliente Fidelizado</p>
                  <p className="text-xs text-lunar-textSecondary">Maria Silva</p>
                </div>
                <Badge variant="secondary" className="text-2xs">5 sessões</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
                <div className="p-2 rounded-lg bg-brand-gradient">
                  <Target className="h-4 w-4 text-white" />
                </div>
                Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Orçamentos Pendentes</p>
                  <p className="text-xs text-lunar-textSecondary">12 em follow-up</p>
                </div>
                <Badge variant="outline" className="text-2xs">R$ 8.5k</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Sazonalidade</p>
                  <p className="text-xs text-lunar-textSecondary">Dezembro promissor</p>
                </div>
                <Badge variant="outline" className="text-2xs">+30%</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div>
                  <p className="text-xs font-medium text-lunar-text">Upsell Potencial</p>
                  <p className="text-xs text-lunar-textSecondary">Produtos extras</p>
                </div>
                <Badge variant="outline" className="text-2xs">R$ 3.2k</Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}