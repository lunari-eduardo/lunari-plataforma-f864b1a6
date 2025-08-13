import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { OriginData } from '@/types/salesAnalytics';
import { OriginTimelineChart } from './OriginTimelineChart';
import { MonthlyOriginData } from '@/services/RevenueAnalyticsService';

interface OriginChartsSectionProps {
  originData: OriginData[];
  monthlyOriginData: MonthlyOriginData[];
}

export function OriginChartsSection({ originData, monthlyOriginData }: OriginChartsSectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 items-stretch">
      {/* Origin Summary Table */}
      <Card className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Resumo por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {originData.map((origin, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: origin.color }}
                  />
                  <div>
                    <p className="text-xs font-medium text-lunar-text">{origin.name}</p>
                    <p className="text-2xs text-lunar-textSecondary">
                      {origin.sessions} sessões ({origin.percentage.toFixed(1)}%)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-lunar-text">
                    {formatCurrency(origin.revenue)}
                  </p>
                  <p className="text-2xs text-lunar-textSecondary">
                    {formatCurrency(origin.sessions > 0 ? origin.revenue / origin.sessions : 0)} / sessão
                  </p>
                </div>
              </div>
            ))}
            {originData.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xs text-lunar-textSecondary">Nenhum dado de origem disponível</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Origin Timeline Chart */}
        <div>
          <OriginTimelineChart monthlyOriginData={monthlyOriginData} />
        </div>
    </div>
  );
}