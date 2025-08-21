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
  availableCategories
}: SalesAnalysisHeroProps) {
  const {
    profile
  } = useUserProfile();
  const name = profile?.nomeCompleto?.split(" ")[0] || "";
  const getPeriodLabel = () => {
    if (selectedMonth === null) {
      return `Ano de ${selectedYear}`;
    }
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${monthNames[selectedMonth]} de ${selectedYear}`;
  };
  const getCategoryLabel = () => {
    if (selectedCategory === 'all') return 'Todas as categorias';
    return selectedCategory;
  };
  return <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 overflow-hidden">
      <div className="relative">
        {/* decorative accents */}
        <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.12]" />
        
      </div>
    </Card>;
}