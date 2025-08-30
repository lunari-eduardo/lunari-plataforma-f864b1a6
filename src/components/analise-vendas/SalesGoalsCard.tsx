import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Calendar, TrendingUp, Settings } from 'lucide-react';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { EmptyGoalsState } from '@/components/shared/EmptyGoalsState';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export function SalesGoalsCard() {
  const navigate = useNavigate();
  
  // Verificar se as metas estão configuradas
  const configStatus = useMemo(() => 
    GoalsIntegrationService.getConfigurationStatus(), 
    []
  );

  // Se não há metas configuradas, mostrar estado vazio
  if (!configStatus.hasConfiguredGoals) {
    return (
      <EmptyGoalsState 
        title="Metas de Vendas"
        description="Configure suas metas anuais na página de precificação para acompanhar o progresso de vendas"
        className="h-full"
      />
    );
  }

  // Obter metas reais da precificação
  const annualGoals = useMemo(() => 
    GoalsIntegrationService.getAnnualGoals(), 
    []
  );
  
  const monthlyGoals = useMemo(() => 
    GoalsIntegrationService.getMonthlyGoals(), 
    []
  );

  // Calcular dados baseados em métricas reais (placeholder por enquanto)
  // TODO: Integrar com dados reais de vendas
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysLeft = daysInMonth - currentDate.getDate();
  
  // Simulação de dados atuais (substituir por dados reais)
  const currentMonthRevenue = monthlyGoals.revenue * 0.85; // 85% da meta mensal
  const currentQuarterRevenue = monthlyGoals.revenue * 2.8; // ~3 meses
  const currentAnnualRevenue = annualGoals.revenue * 0.75; // 75% da meta anual
  
  const goals = [
    {
      title: 'Meta Mensal',
      current: currentMonthRevenue,
      target: monthlyGoals.revenue,
      period: currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      daysLeft: daysLeft,
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentMonthRevenue, monthlyGoals.revenue)
      )
    },
    {
      title: 'Meta Trimestral',
      current: currentQuarterRevenue,
      target: monthlyGoals.revenue * 3,
      period: `Q${Math.ceil(currentMonth / 3)} ${currentYear}`,
      daysLeft: daysLeft,
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentQuarterRevenue, monthlyGoals.revenue * 3)
      )
    },
    {
      title: 'Meta Anual',
      current: currentAnnualRevenue,
      target: annualGoals.revenue,
      period: currentYear.toString(),
      daysLeft: Math.floor((new Date(currentYear, 11, 31).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)),
      status: GoalsIntegrationService.getProgressStatus(
        GoalsIntegrationService.calculateProgress(currentAnnualRevenue, annualGoals.revenue)
      )
    }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return 'text-green-500';
      case 'behind':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on-track':
        return { text: 'No Caminho', variant: 'default' as const };
      case 'behind':
        return { text: 'Atrasado', variant: 'destructive' as const };
      default:
        return { text: 'Atenção', variant: 'secondary' as const };
    }
  };

  return (
    <Card className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            Metas e Objetivos
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => navigate('/precificacao')}
          >
            <Settings className="h-3 w-3 mr-1" />
            Configurar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((goal, index) => {
          const progress = (goal.current / goal.target) * 100;
          const remaining = goal.target - goal.current;
          const statusBadge = getStatusBadge(goal.status);
          
          return (
            <div key={index} className="p-3 bg-lunar-bg rounded-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-medium text-lunar-text">{goal.title}</h4>
                  <Badge variant={statusBadge.variant} className="text-2xs">
                    {statusBadge.text}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-2xs text-lunar-textSecondary">
                  <Calendar className="h-3 w-3" />
                  {goal.daysLeft} dias restantes
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-lunar-textSecondary">{goal.period}</span>
                  <span className="font-medium text-lunar-text">
                    {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                  </span>
                </div>
                
                <Progress value={progress} className="h-2" />
                
                <div className="flex items-center justify-between text-2xs">
                  <span className={`flex items-center gap-1 ${getStatusColor(goal.status)}`}>
                    <TrendingUp className="h-3 w-3" />
                    {progress.toFixed(1)}% alcançado
                  </span>
                  <span className="text-lunar-textSecondary">
                    {remaining > 0 ? `${formatCurrency(remaining)} restante` : 'Meta atingida!'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Quick Actions */}
        <div className="pt-2 border-t border-lunar-border/50">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => navigate('/precificacao')}
            >
              <Target className="h-3 w-3 mr-1" />
              Editar Metas
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Ver Histórico
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}