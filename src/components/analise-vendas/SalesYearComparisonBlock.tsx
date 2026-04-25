import { ArrowUp, ArrowDown, Minus, GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComparisonValue, formatVariation } from '@/domain/sales/comparisonUtils';
import { SalesComparisonResult } from '@/domain/sales/sales-domain';

interface Props {
  comparison: SalesComparisonResult;
  baseYear: number;
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function SalesYearComparisonBlock({ comparison, baseYear }: Props) {
  const items = [
    {
      label: 'Receita Total',
      formatter: formatCurrency,
      comp: comparison.metrics.totalRevenue,
    },
    {
      label: 'Sessões',
      formatter: (v: number) => v.toString(),
      comp: comparison.metrics.totalSessions,
    },
    {
      label: 'Ticket Médio',
      formatter: formatCurrency,
      comp: comparison.metrics.averageTicket,
    },
    {
      label: 'Receita Fotos Extras',
      formatter: formatCurrency,
      comp: comparison.metrics.extraPhotosRevenue,
    },
  ];

  const periodLabel = `Jan – ${MONTH_ABBR[comparison.limitMonth]}`;

  return (
    <div className="bg-lunar-surface/80 rounded-xl p-5 border border-lunar-border/30">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <GitCompareArrows className="h-4 w-4 text-lunar-textSecondary" />
        <h2 className="text-sm font-semibold text-lunar-text">
          Comparativo anual
        </h2>
        <span className="text-xs text-lunar-textSecondary">
          {baseYear} vs {comparison.comparisonYear}
        </span>
      </div>
      <p className="text-xs text-lunar-textSecondary mb-4">
        Comparando {periodLabel} {baseYear} vs {periodLabel} {comparison.comparisonYear}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item, idx) => (
          <ComparisonItem
            key={idx}
            label={item.label}
            comp={item.comp}
            formatter={item.formatter}
            baseYear={baseYear}
            comparisonYear={comparison.comparisonYear}
          />
        ))}
      </div>
    </div>
  );
}

interface ComparisonItemProps {
  label: string;
  comp: ComparisonValue;
  formatter: (value: number) => string;
  baseYear: number;
  comparisonYear: number;
}

function ComparisonItem({ label, comp, formatter, baseYear, comparisonYear }: ComparisonItemProps) {
  const isPositive = comp.isNew || (comp.diffPercentage !== null && comp.diffPercentage > 0);
  const isNegative = comp.diffPercentage !== null && comp.diffPercentage < 0;
  const Icon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;

  const colorClass = isPositive
    ? 'text-emerald-500 bg-emerald-500/10'
    : isNegative
      ? 'text-rose-500 bg-rose-500/10'
      : 'text-lunar-textSecondary bg-lunar-border/20';

  return (
    <div className="rounded-lg border border-lunar-border/30 bg-lunar-bg/40 p-3">
      <p className="text-xs text-lunar-textSecondary mb-1.5 truncate">{label}</p>
      <p className="text-lg font-bold text-lunar-text tracking-tight mb-0.5">
        {formatter(comp.current)}
      </p>
      <p className="text-xs text-lunar-textSecondary mb-2">
        {comparisonYear}: {formatter(comp.previous)}
      </p>
      <div className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', colorClass)}>
        <Icon className="h-3 w-3" />
        <span>{formatVariation(comp)}</span>
      </div>
    </div>
  );
}
