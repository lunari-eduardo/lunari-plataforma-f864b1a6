import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesTopPerformances } from '@/hooks/useSalesTopPerformances';

interface SalesInsightsSectionProps {
  selectedYear: number;
  selectedMonth: number | null;
  selectedCategory: string;
}

export function SalesInsightsSection({
  selectedYear,
  selectedMonth,
  selectedCategory,
}: SalesInsightsSectionProps) {
  const { melhorMes, melhorServico, clienteFidelizado, isLoading } = useSalesTopPerformances(
    selectedYear,
    selectedMonth,
    selectedCategory
  );

  return (
    <div className="bg-lunar-surface/50 rounded-xl p-4 border border-lunar-border/30">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-lunar-text">Top Performances</h3>
      </div>

      <div className="space-y-0.5">
        {isLoading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : (
          <>
            <InsightItem
              title="Melhor Mês"
              subtitle={melhorMes.subtitle}
              value={melhorMes.value}
              hasData={melhorMes.hasData}
            />
            <InsightItem
              title="Melhor Serviço"
              subtitle={melhorServico.subtitle}
              value={melhorServico.value}
              hasData={melhorServico.hasData}
            />
            <InsightItem
              title="Cliente Fidelizado"
              subtitle={clienteFidelizado.subtitle}
              value={clienteFidelizado.value}
              hasData={clienteFidelizado.hasData}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface InsightItemProps {
  title: string;
  subtitle: string;
  value: string;
  hasData: boolean;
}

function InsightItem({ title, subtitle, value, hasData }: InsightItemProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-lunar-border/20 last:border-0">
      <div>
        <p className="text-xs font-medium text-lunar-text">{title}</p>
        <p className="text-2xs text-lunar-textSecondary">{subtitle}</p>
      </div>
      {hasData && value && (
        <Badge variant="secondary" className="text-2xs">
          {value}
        </Badge>
      )}
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-lunar-border/20 last:border-0">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}
