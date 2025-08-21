import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, Calendar, Users } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCurrency } from "@/utils/financialUtils";

interface SalesAnalysisHeroProps {
  selectedYear: number;
  selectedMonth: number | null;
  selectedCategory: string;
  totalRevenue: number;
  totalSessions: number;
  conversionRate: number;
  availableCategories: string[];
}

export default function SalesAnalysisHero({
  selectedYear,
  selectedMonth,
  selectedCategory,
  totalRevenue,
  totalSessions,
  conversionRate,
  availableCategories,
}: SalesAnalysisHeroProps) {
  const { profile } = useUserProfile();
  const name = profile?.nomeCompleto?.split(" ")[0] || "";

  const getPeriodLabel = () => {
    if (selectedMonth === null) {
      return `Ano de ${selectedYear}`;
    }
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${monthNames[selectedMonth]} de ${selectedYear}`;
  };

  const getCategoryLabel = () => {
    if (selectedCategory === 'all') return 'Todas as categorias';
    return selectedCategory;
  };

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 overflow-hidden">
      <div className="relative">
        {/* decorative accents */}
        <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.12]" />
        <CardContent className="relative py-6 px-6 md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-gradient">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-lunar-text">
                  Análise de Vendas
                  {name ? `, ${name}` : ''}
                </h1>
              </div>
              <p className="mt-1 text-2xs text-lunar-textSecondary">
                Insights detalhados para {getPeriodLabel()} • {getCategoryLabel()}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300">
                  <TrendingUp className="mr-2 h-4 w-4 text-lunar-accent" />
                  {formatCurrency(totalRevenue)} em receita
                </Badge>
                <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300">
                  <Calendar className="mr-2 h-4 w-4 text-lunar-success" />
                  {totalSessions} sessões realizadas
                </Badge>
                <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300">
                  <Users className="mr-2 h-4 w-4 text-lunar-warning" />
                  {conversionRate.toFixed(1)}% conversão
                </Badge>
              </div>

              <div className="mt-3 flex gap-2">
                <Link to="/leads"><Button size="sm" variant="secondary">Ver Leads</Button></Link>
                <Link to="/orcamentos"><Button size="sm" variant="ghost">Ver Orçamentos</Button></Link>
              </div>
            </div>

            <div className="hidden md:flex flex-col items-end gap-1 text-right">
              <span className="text-2xs text-lunar-textSecondary">Categorias disponíveis</span>
              <span className="text-sm font-medium text-lunar-text">
                {availableCategories.length} categoria{availableCategories.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}