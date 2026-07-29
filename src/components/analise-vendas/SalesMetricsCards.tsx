import { Camera, TrendingUp, Wallet, Receipt, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SalesMetrics } from '@/hooks/useSalesAnalytics';
import { cn } from '@/lib/utils';
import { MetricIconBadge } from '@/components/ui/metric-icon';
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
            className="rounded-2xl border border-border/60 bg-card p-3 sm:p-5 animate-pulse"
          >
            <div className="h-3 w-20 bg-muted/60 rounded mb-3" />
            <div className="h-6 w-28 bg-muted/60 rounded" />
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
      icon: TrendingUp,
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
      icon: Receipt,

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
              "group relative rounded-2xl border border-border/60 bg-card p-3 sm:p-5",
              "transition-all duration-200 hover:border-border hover:-translate-y-0.5",
              "hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.12)]"
            )}
          >
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-medium text-muted-foreground truncate">
                  {metric.title}
                </div>
                <p className="mt-1.5 sm:mt-2 text-[18px] sm:text-[26px] leading-tight font-semibold tracking-tight tabular-nums text-foreground">
                  {metric.value}
                </p>
              </div>
              <MetricIconBadge Icon={Icon} />
            </div>
            {metric.comparison && comparison ? (
              <ComparisonBadge
                comp={metric.comparison}
                comparisonYear={comparison.comparisonYear}
              />
            ) : metric.subtitle ? (
              <p className="text-[10.5px] sm:text-[11px] text-muted-foreground/80 mt-2 truncate">
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
