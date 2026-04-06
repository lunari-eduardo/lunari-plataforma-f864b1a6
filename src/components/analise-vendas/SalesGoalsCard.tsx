import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Settings } from 'lucide-react';
import { EmptyGoalsState } from '@/components/shared/EmptyGoalsState';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMetasPersonalizadas } from '@/hooks/useMetasPersonalizadas';

interface SalesGoalsCardProps {
  selectedYear: number;
  selectedMonth: number | null;
  selectedCategory?: string;
  currentRevenue?: number;
}

export function SalesGoalsCard({ selectedYear, selectedMonth, selectedCategory = 'all', currentRevenue = 0 }: SalesGoalsCardProps) {
  const navigate = useNavigate();
  
  const { getMetaParaMes, getMetaAnual, getMetaParaCategoria, loading } = useMetasPersonalizadas(selectedYear);

  const goals = useMemo(() => {
    const result: { title: string; current: number; target: number; daysLeft: number; origem: string }[] = [];
    const currentDate = new Date();

    if (selectedCategory !== 'all') {
      // Category filter active → show category goal only
      const meta = getMetaParaCategoria(selectedCategory);
      if (meta.metaFaturamento <= 0) return result; // no goal configured
      const daysLeftYear = selectedYear === currentDate.getFullYear()
        ? Math.floor((new Date(selectedYear, 11, 31).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
        : 365;
      result.push({
        title: 'Categoria',
        current: currentRevenue,
        target: meta.metaFaturamento,
        daysLeft: daysLeftYear,
        origem: meta.origem
      });
    } else if (selectedMonth !== null) {
      // Month filter active, no category → show monthly goal only
      const meta = getMetaParaMes(selectedMonth);
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const daysLeft = selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth() + 1
        ? Math.max(0, daysInMonth - currentDate.getDate())
        : daysInMonth;
      result.push({
        title: 'Mensal',
        current: currentRevenue,
        target: meta.metaFaturamento,
        daysLeft,
        origem: meta.origem
      });
    } else {
      // Year total, no category → show annual goal only
      const meta = getMetaAnual();
      const daysLeftYear = selectedYear === currentDate.getFullYear()
        ? Math.floor((new Date(selectedYear, 11, 31).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
        : 365;
      result.push({
        title: 'Anual',
        current: currentRevenue,
        target: meta.metaFaturamento,
        daysLeft: daysLeftYear,
        origem: meta.origem
      });
    }

    return result;
  }, [selectedYear, selectedMonth, selectedCategory, currentRevenue, getMetaParaMes, getMetaAnual, getMetaParaCategoria]);

  if (loading) return null;

  if (goals.length === 0) {
    return (
      <EmptyGoalsState 
        title="Metas de Vendas"
        description={selectedCategory !== 'all' 
          ? "Nenhuma meta configurada para esta categoria. Configure em Finanças > Metas"
          : "Configure suas metas na precificação ou em Finanças > Metas"}
        className="h-auto py-6"
      />
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusInfo = (progress: number) => {
    if (progress >= 100) return { color: 'text-green-600', bgColor: '[&>div]:bg-green-500' };
    if (progress >= 70) return { color: 'text-yellow-600', bgColor: '[&>div]:bg-yellow-500' };
    return { color: 'text-red-600', bgColor: '[&>div]:bg-destructive' };
  };

  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
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
      
      <div className="space-y-2.5">
        {goals.map((goal, index) => {
          const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
          const progressClamped = Math.min(progress, 100);
          const statusInfo = getStatusInfo(progress);
          const excedente = goal.current - goal.target;
          
          return (
            <div key={index} className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground w-16 shrink-0">
                {goal.title}
              </span>
              
              <div className="flex-1 min-w-0">
                <Progress 
                  value={progressClamped} 
                  className={cn("h-1.5", statusInfo.bgColor)} 
                />
              </div>
              
              <span className={cn("text-2xs font-medium w-12 text-right", statusInfo.color)}>
                {progress.toFixed(0)}%
              </span>
              
              <div className="items-center gap-1 hidden sm:flex">
                {progress > 100 && excedente > 0 ? (
                  <Badge 
                    variant="outline" 
                    className="text-2xs h-5 px-1.5 text-green-600 border-green-300"
                  >
                    +{formatCurrency(excedente)}
                  </Badge>
                ) : (
                  <Badge 
                    variant="outline" 
                    className="text-2xs h-5 px-1.5"
                    title={goal.origem === 'personalizada' ? 'Meta personalizada' : 'Meta da precificação'}
                  >
                    {goal.origem === 'personalizada' ? '🎯' : '📊'} {goal.daysLeft}d
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
