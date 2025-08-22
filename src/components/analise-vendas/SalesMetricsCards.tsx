import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Calendar, Camera } from 'lucide-react';
import { SalesMetrics } from '@/hooks/useSalesAnalytics';
interface SalesMetricsCardsProps {
  metrics: SalesMetrics;
}
export function SalesMetricsCards({
  metrics
}: SalesMetricsCardsProps) {
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
    change: 12.5,
    trend: 'up' as const,
    icon: DollarSign,
    description: 'Receita bruta do período'
  }, {
    title: 'Sessões Realizadas',
    value: metrics.totalSessions,
    change: 6.7,
    trend: 'up' as const,
    icon: Camera,
    description: 'Total de sessões realizadas'
  }, {
    title: 'Ticket Médio',
    value: formatCurrency(metrics.averageTicket),
    change: metrics.averageTicket > 2500 ? 8.3 : -3.1,
    trend: (metrics.averageTicket > 2500 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
    icon: TrendingUp,
    description: 'Valor médio por sessão'
  }, {
    title: 'Taxa de Conversão',
    value: `${metrics.conversionRate.toFixed(1)}%`,
    change: 5.2,
    trend: 'up' as const,
    icon: Target,
    description: 'Orçamentos fechados vs enviados'
  }];
  return <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-4 my-0 py-[6px]">
        <CardTitle className="text-lg font-semibold">Métricas principais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsCards.map((metric, index) => {
          const Icon = metric.icon;
          const isPositive = metric.trend === 'up';
          const isNegative = metric.trend === 'down';
          return <div key={index} className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-lunar-textSecondary font-medium">{metric.title}</span>
                  <div className="p-2 rounded-lg bg-brand-gradient">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <p className="text-lg font-semibold">{metric.value}</p>
                  {metric.trend !== 'neutral'}
                </div>
                <p className="text-2xs text-lunar-textSecondary mt-1">{metric.description}</p>
              </div>;
        })}
        </div>
      </CardContent>
    </Card>;
}