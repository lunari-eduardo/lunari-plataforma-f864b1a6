import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Settings } from 'lucide-react';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { EmptyGoalsState } from '@/components/shared/EmptyGoalsState';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export function SalesGoalsCard() {
  const navigate = useNavigate();
  
  const configStatus = useMemo(() => 
    GoalsIntegrationService.getConfigurationStatus(), 
    []
  );

  if (!configStatus.hasConfiguredGoals) {
    return (
      <EmptyGoalsState 
        title="Metas de Vendas"
        description="Configure suas metas na precificação para acompanhar o progresso"
        className="h-auto py-6"
      />
    );
  }

  const annualGoals = useMemo(() => 
    GoalsIntegrationService.getAnnualGoals(), 
    []
  );
  
  const monthlyGoals = useMemo(() => 
    GoalsIntegrationService.getMonthlyGoals(), 
    []
  );

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysLeft = daysInMonth - currentDate.getDate();
  
  const currentMonthRevenue = monthlyGoals.revenue * 0.85;
  const currentQuarterRevenue = monthlyGoals.revenue * 2.8;
  const currentAnnualRevenue = annualGoals.revenue * 0.75;
  
  const goals = [
    {
      title: 'Mensal',
      current: currentMonthRevenue,
      target: monthlyGoals.revenue,
      daysLeft: daysLeft,
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentMonthRevenue, monthlyGoals.revenue)
      )
    },
    {
      title: 'Trimestral',
      current: currentQuarterRevenue,
      target: monthlyGoals.revenue * 3,
      daysLeft: daysLeft,
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentQuarterRevenue, monthlyGoals.revenue * 3)
      )
    },
    {
      title: 'Anual',
      current: currentAnnualRevenue,
      target: annualGoals.revenue,
      daysLeft: Math.floor((new Date(currentYear, 11, 31).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)),
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentAnnualRevenue, annualGoals.revenue)
      )
    }
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on-track':
        return { text: 'No caminho', variant: 'default' as const };
      case 'behind':
        return { text: 'Atrasado', variant: 'destructive' as const };
      default:
        return { text: 'Atenção', variant: 'secondary' as const };
    }
  };

  return (
    <div className="bg-lunar-surface/50 rounded-xl p-4 border border-lunar-border/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <span className="text-xs font-medium text-lunar-textSecondary">Metas</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-2xs px-2"
          onClick={() => navigate('/precificacao')}
        >
          <Settings className="h-3 w-3 mr-1" />
          Configurar
        </Button>
      </div>
      
      {/* Goals List - Horizontal Lines */}
      <div className="space-y-2.5">
        {goals.map((goal, index) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100);
          const statusBadge = getStatusBadge(goal.status);
          
          return (
            <div key={index} className="flex items-center gap-3">
              {/* Label */}
              <span className="text-2xs text-lunar-textSecondary w-16 shrink-0">
                {goal.title}
              </span>
              
              {/* Progress Bar */}
              <div className="flex-1 min-w-0">
                <Progress 
                  value={progress} 
                  className={cn(
                    "h-1.5",
                    goal.status === 'behind' && "[&>div]:bg-destructive",
                    goal.status === 'ahead' && "[&>div]:bg-yellow-500"
                  )} 
                />
              </div>
              
              {/* Percentage */}
              <span className="text-2xs font-medium text-lunar-text w-10 text-right">
                {progress.toFixed(0)}%
              </span>
              
              {/* Status Badge - Hidden on mobile */}
              <Badge 
                variant={statusBadge.variant} 
                className="text-2xs h-5 hidden sm:flex"
              >
                {goal.daysLeft}d
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
