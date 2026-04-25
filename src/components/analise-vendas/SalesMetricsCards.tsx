import { DollarSign, Camera, TrendingUp, Wallet, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SalesMetrics } from '@/hooks/useSalesAnalytics';
import { cn } from '@/lib/utils';
import { ComparativeMetrics, ComparisonValue, formatVariation } from '@/domain/sales/comparisonUtils';

interface SalesMetricsCardsProps {
  metrics: SalesMetrics;
  comparison?: {
    metrics: ComparativeMetrics;
    comparisonYear: number;
  } | null;
}

export function SalesMetricsCards({ metrics, comparison }: SalesMetricsCardsProps) {
  // Skeleton loading quando metrics é null
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div 
            key={i} 
            className="bg-lunar-surface/80 rounded-xl p-4 border border-lunar-border/30 animate-pulse"
          >
            <div className="h-3.5 w-20 bg-lunar-border/30 rounded mb-2" />
            <div className="h-7 w-28 bg-lunar-border/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const expectedRevenue = (metrics as any).expectedRevenue ?? 0;
  const pendingRevenue = (metrics as any).pendingRevenue ?? 0;

  const metricsCards = [
    {
      title: 'Receita Total',
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      subtitle: undefined as string | undefined,
      comparison: comparison?.metrics.totalRevenue,
    },
    {
      title: 'Valor Previsto',
      value: formatCurrency(expectedRevenue),
      icon: Wallet,
      subtitle: pendingRevenue > 0 ? `A receber: ${formatCurrency(pendingRevenue)}` : undefined,
      comparison: comparison?.metrics.expectedRevenue,
    },
    {
      title: 'Sessões',
      value: metrics.totalSessions.toString(),
      icon: Camera,
      subtitle: undefined,
      comparison: comparison?.metrics.totalSessions,
    },
    {
      title: 'Ticket Médio',
      value: formatCurrency(metrics.averageTicket),
      icon: TrendingUp,
      subtitle: undefined,
      comparison: comparison?.metrics.averageTicket,
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricsCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div 
            key={index} 
            className={cn(
              "bg-lunar-surface/80 rounded-xl p-4",
              "border border-lunar-border/30",
              "transition-all duration-200"
            )}
          >
            <div className="flex items-center gap-1.5 text-lunar-textSecondary mb-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium truncate">{metric.title}</span>
            </div>
            <p className="text-2xl font-bold text-lunar-text tracking-tight">
              {metric.value}
            </p>
            {metric.comparison && comparison ? (
              <ComparisonBadge
                comp={metric.comparison}
                comparisonYear={comparison.comparisonYear}
              />
            ) : metric.subtitle ? (
              <p className="text-xs text-lunar-textSecondary mt-1 truncate">
                {metric.subtitle}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ComparisonBadge({ comp, comparisonYear }: { comp: ComparisonValue; comparisonYear: number }) {
  const label = formatVariation(comp);
  const isPositive = comp.isNew || (comp.diffPercentage !== null && comp.diffPercentage > 0);
  const isNegative = comp.diffPercentage !== null && comp.diffPercentage < 0;
  const isNeutral = !isPositive && !isNegative;

  const Icon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;
  const colorClass = isPositive
    ? 'text-emerald-500'
    : isNegative
      ? 'text-rose-500'
      : 'text-lunar-textSecondary';

  return (
    <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium truncate', colorClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}</span>
      <span className="text-lunar-textSecondary font-normal">vs {comparisonYear}</span>
    </div>
  );
}
