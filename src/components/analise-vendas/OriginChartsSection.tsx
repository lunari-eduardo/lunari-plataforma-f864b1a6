import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart3 } from 'lucide-react';
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

  const hasData = originData && originData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
      {/* Origin Summary Table */}
      <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-lunar-textSecondary" />
            <h3 className="text-xs font-medium text-lunar-text">Resumo por Origem</h3>
          </div>
          
          {hasData ? (
            <div className="space-y-1.5">
              {originData.map((origin, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 bg-lunar-bg/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: origin.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-lunar-text truncate">
                        {origin.name}
                      </p>
                      <p className="text-2xs text-lunar-textSecondary">
                        {origin.sessions} sessões ({origin.percentage.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-medium text-lunar-text">
                      {formatCurrency(origin.revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <BarChart3 className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
              <p className="text-2xs text-lunar-textSecondary">Sem dados de origem</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Origin Timeline Chart */}
      <OriginTimelineChart monthlyOriginData={monthlyOriginData} />
    </div>
  );
}
