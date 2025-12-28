import { DollarSign, Camera, TrendingUp } from 'lucide-react';
import { SalesMetrics } from '@/hooks/useSalesAnalytics';
import { cn } from '@/lib/utils';

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

  const metricsCards = [
    {
      title: 'Receita Total',
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign
    },
    {
      title: 'Sessões',
      value: metrics.totalSessions.toString(),
      icon: Camera
    },
    {
      title: 'Ticket Médio',
      value: formatCurrency(metrics.averageTicket),
      icon: TrendingUp
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metricsCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div 
            key={index} 
            className={cn(
              "bg-lunar-surface/80 rounded-xl p-3",
              "border border-lunar-border/30",
              "transition-all duration-200"
            )}
          >
            <div className="flex items-center gap-1.5 text-lunar-textSecondary mb-1">
              <Icon className="h-3 w-3" />
              <span className="text-2xs font-medium truncate">{metric.title}</span>
            </div>
            <p className="text-xl font-bold text-lunar-text tracking-tight">
              {metric.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
