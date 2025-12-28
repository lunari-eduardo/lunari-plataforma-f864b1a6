import { DollarSign, BarChart3, Users, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/utils/financialUtils";
import { useIsTablet } from "@/hooks/useIsTablet";
import { Skeleton } from "@/components/ui/skeleton";

interface KPIGroupCardProps {
  receitaMes: number;
  metaMes: number;
  progressoMeta: number;
  topCategoria: {
    name: string;
    revenue: number;
    sessions: number;
  } | null;
  novosClientes60d: number;
  valorPrevisto: number;
  isLoading?: boolean;
}

export function KPIGroupCard({
  receitaMes,
  metaMes,
  progressoMeta,
  topCategoria,
  novosClientes60d,
  valorPrevisto,
  isLoading = false
}: KPIGroupCardProps) {
  const isTablet = useIsTablet();
  const navigate = useNavigate();

  const hasConfiguredGoals = metaMes > 0;
  
  const handleConfigureGoals = () => {
    navigate('/app/precificacao');
  };

  if (isLoading) {
    return (
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Indicadores principais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-lunar-border/30 bg-card-gradient p-4">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const revenueCard = (
    <div className={`dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 h-full ${isTablet ? 'p-6' : 'p-4'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-lunar-textSecondary font-medium">Receita do mês</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <p className={`font-semibold ${isTablet ? 'text-2xl' : 'text-lg'}`}>{formatCurrency(receitaMes)}</p>
        {hasConfiguredGoals ? (
          <span className="text-xs text-lunar-textSecondary">Meta: {formatCurrency(metaMes)}</span>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleConfigureGoals} className="text-xs h-auto p-1 text-lunar-textSecondary hover:text-lunar-text">
            <Settings className="h-3 w-3 mr-1" />
            Configurar Meta
          </Button>
        )}
      </div>
      {hasConfiguredGoals && (
        <div className="mt-3">
          <Progress value={progressoMeta} className="h-2" />
          <span className="text-xs text-lunar-textSecondary mt-1 block">{progressoMeta.toFixed(0)}% da meta</span>
        </div>
      )}
    </div>
  );

  const categoryCard = (
    <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Categoria mais rentável</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {topCategoria ? (
          <div>
            <p className="font-semibold text-base">{topCategoria.name}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">
              Receita: {formatCurrency(topCategoria.revenue)} • {topCategoria.sessions} sessões
            </p>
          </div>
        ) : (
          <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
        )}
      </div>
    </div>
  );

  const clientsCard = (
    <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Novos clientes (60 dias)</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <Users className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <p className="font-semibold text-base">{novosClientes60d}</p>
        <p className="text-2xs text-lunar-textSecondary mt-1">Cadastrados recentemente</p>
      </div>
    </div>
  );

  const forecastCard = (
    <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-lunar-textSecondary font-medium">Total Previsto</span>
        <div className="p-2 rounded-lg bg-brand-gradient">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex-1 flex items-center">
        <div className="text-2xl font-bold text-lunar-text">
          {formatCurrency(valorPrevisto)}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Indicadores principais</CardTitle>
      </CardHeader>
      <CardContent>
        {isTablet ? (
          <div className="space-y-4">
            <div className="w-full">{revenueCard}</div>
            <div className="grid grid-cols-2 gap-4 auto-rows-fr">
              <div className="h-full">{categoryCard}</div>
              <div className="h-full">{clientsCard}</div>
              <div className="col-span-2 h-full">{forecastCard}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {revenueCard}
            {categoryCard}
            {clientsCard}
            {forecastCard}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
