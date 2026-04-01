import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Settings } from 'lucide-react';
import { EmptyGoalsState } from '@/components/shared/EmptyGoalsState';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMetasPersonalizadas } from '@/hooks/useMetasPersonalizadas';
import { useWorkflowMetricsRealtime } from '@/hooks/useWorkflowMetricsRealtime';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';

interface SalesGoalsCardProps {
  selectedYear: number;
  selectedMonth: number | null;
}

export function SalesGoalsCard({ selectedYear, selectedMonth }: SalesGoalsCardProps) {
  const navigate = useNavigate();
  
  const { getMetaParaMes, getMetaAnual, loading } = useMetasPersonalizadas(selectedYear);
  
  // Métricas reais do workflow
  const workflowMetrics = useWorkflowMetricsRealtime(
    selectedYear, 
    selectedMonth || undefined
  );

  const configStatus = useMemo(() => 
    GoalsIntegrationService.getConfigurationStatus(), 
    []
  );

  if (!configStatus.hasConfiguredGoals && !loading) {
    return (
      <EmptyGoalsState 
        title="Metas de Vendas"
        description="Configure suas metas na precificação ou em Finanças > Metas"
        className="h-auto py-6"
      />
    );
  }

  // Dados reais
  const receitaAtual = workflowMetrics.receita;

  // Meta mensal
  const metaMensal = useMemo(() => {
    const mes = selectedMonth || new Date().getMonth() + 1;
    return getMetaParaMes(mes);
  }, [selectedMonth, getMetaParaMes]);

  // Meta anual
  const metaAnual = useMemo(() => getMetaAnual(), [getMetaAnual]);

  // Receita anual (se filtrando por mês, mostramos a receita do mês)
  const receitaAnualMetrics = useWorkflowMetricsRealtime(selectedYear);
  const receitaAnual = receitaAnualMetrics.receita;

  const currentDate = new Date();
  const currentMonth = selectedMonth || currentDate.getMonth() + 1;
  const daysInMonth = new Date(selectedYear, currentMonth, 0).getDate();
  const daysLeft = selectedYear === currentDate.getFullYear() && currentMonth === currentDate.getMonth() + 1
    ? daysInMonth - currentDate.getDate()
    : daysInMonth;

  const daysLeftYear = selectedYear === currentDate.getFullYear()
    ? Math.floor((new Date(selectedYear, 11, 31).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
    : 365;

  const goals = [
    {
      title: 'Mensal',
      current: selectedMonth ? receitaAtual : receitaAtual, // receita do período selecionado
      target: metaMensal.metaFaturamento,
      daysLeft,
      origem: metaMensal.origem
    },
    {
      title: 'Anual',
      current: receitaAnual,
      target: metaAnual.metaFaturamento,
      daysLeft: daysLeftYear,
      origem: metaAnual.origem
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

  const getStatusInfo = (progress: number) => {
    if (progress >= 100) return { text: 'Acima', color: 'text-green-600', bgColor: '[&>div]:bg-green-500' };
    if (progress >= 70) return { text: 'No caminho', color: 'text-yellow-600', bgColor: '[&>div]:bg-yellow-500' };
    return { text: 'Abaixo', color: 'text-red-600', bgColor: '[&>div]:bg-destructive' };
  };

  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Metas</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-2xs px-2"
          onClick={() => navigate('/app/financas?tab=metas')}
        >
          <Settings className="h-3 w-3 mr-1" />
          Configurar
        </Button>
      </div>
      
      {/* Goals List */}
      <div className="space-y-2.5">
        {goals.map((goal, index) => {
          const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          const statusInfo = getStatusInfo(progress);
          
          return (
            <div key={index} className="flex items-center gap-3">
              {/* Label */}
              <span className="text-2xs text-muted-foreground w-16 shrink-0">
                {goal.title}
              </span>
              
              {/* Progress Bar */}
              <div className="flex-1 min-w-0">
                <Progress 
                  value={progress} 
                  className={cn("h-1.5", statusInfo.bgColor)} 
                />
              </div>
              
              {/* Percentage */}
              <span className={cn("text-2xs font-medium w-10 text-right", statusInfo.color)}>
                {progress.toFixed(0)}%
              </span>
              
              {/* Origin indicator + days */}
              <div className="flex items-center gap-1 hidden sm:flex">
                <Badge 
                  variant="outline" 
                  className="text-2xs h-5 px-1.5"
                  title={goal.origem === 'personalizada' ? 'Meta personalizada' : 'Meta da precificação'}
                >
                  {goal.origem === 'personalizada' ? '🎯' : '📊'} {goal.daysLeft}d
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
