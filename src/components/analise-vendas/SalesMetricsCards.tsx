import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Calendar } from 'lucide-react';
import { SalesMetrics } from '@/hooks/useSalesAnalytics';

interface SalesMetricsCardsProps {
  metrics: SalesMetrics;
}

export function SalesMetricsCards({ metrics }: SalesMetricsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const metricsCards = [{
    title: 'Receita Total',
    value: formatCurrency(metrics.totalRevenue),
    change: '+12.5%',
    trend: 'up' as const,
    icon: DollarSign,
    description: 'no período'
  }, {
    title: 'Conversão',
    value: `${metrics.conversionRate.toFixed(0)}%`,
    change: '+5.2%',
    trend: 'up' as const,
    icon: Target,
    description: 'orçamentos → vendas'
  }, {
    title: 'Ticket Médio',
    value: formatCurrency(metrics.averageTicket),
    change: metrics.averageTicket > 2500 ? '+8.3%' : '-3.1%',
    trend: metrics.averageTicket > 2500 ? 'up' as const : 'down' as const,
    icon: TrendingUp,
    description: 'por sessão'
  }, {
    title: 'Novos Clientes',
    value: metrics.newClients.toString(),
    change: '+18.7%',
    trend: 'up' as const,
    icon: Users,
    description: 'no período'
  }, {
    title: 'Sessões Realizadas',
    value: metrics.totalSessions.toString(),
    change: '+6.7%',
    trend: 'up' as const,
    icon: Calendar,
    description: 'no período'
  }, {
    title: 'Meta Mensal',
    value: `${Math.min(metrics.monthlyGoalProgress, 100).toFixed(0)}%`,
    change: `R$ ${Math.max(50000 - (metrics.totalRevenue / 12), 0).toLocaleString()} restante`,
    trend: 'neutral' as const,
    icon: Target,
    description: 'progresso atual'
  }];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 py-2 my-0 px-2 md:px-4 lg:px-[34px]">
      {metricsCards.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = metric.trend === 'up';
        const isNegative = metric.trend === 'down';
        
        return (
          <Card key={index} className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-lunar-accent'}`} />
                {metric.trend !== 'neutral' && (
                  <Badge variant={isPositive ? 'default' : 'destructive'} className="text-2xs h-5">
                    {isPositive ? <TrendingUp className="h-2 w-2 mr-1" /> : <TrendingDown className="h-2 w-2 mr-1" />}
                    {metric.change}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xs font-medium text-lunar-textSecondary">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                <p className="text-lg font-bold text-lunar-text">{metric.value}</p>
                <p className="text-2xs text-lunar-textSecondary">{metric.description}</p>
                {metric.trend === 'neutral' && (
                  <Badge variant="outline" className="text-2xs">
                    {metric.change}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}