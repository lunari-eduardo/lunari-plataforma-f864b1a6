import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';
import { useLeadLossReasons } from '@/hooks/useLeadLossReasons';
import { cn } from '@/lib/utils';

export function LeadLossReasonsChart() {
  const { lossReasonStats, totalLostLeads, leadsWithoutReason, hasData } = useLeadLossReasons();

  if (!hasData) {
    return (
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Motivos de Leads Perdidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingDown className="h-8 w-8 text-lunar-textSecondary mb-2" />
            <p className="text-sm text-lunar-textSecondary">
              Nenhum lead perdido encontrado
            </p>
            <p className="text-xs text-lunar-textSecondary mt-1">
              Dados aparecerão quando houver leads marcados como perdidos
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter and sort by count descending
  const chartData = lossReasonStats
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <Card className="border-0 shadow-lg bg-lunar-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          Motivos de Leads Perdidos
          <Badge variant="outline" className="text-2xs ml-auto">
            {totalLostLeads} perdidos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Warning for missing reasons */}
          {leadsWithoutReason > 0 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {leadsWithoutReason} leads sem motivo informado
              </p>
            </div>
          )}

          {/* Ranked Bar List */}
          <div className="space-y-2">
            {chartData.map((stat, index) => {
              const barWidth = Math.max((stat.count / maxCount) * 100, 2);
              const opacity = 1 - (index * 0.1);
              
              return (
                <div key={stat.id} className="group">
                  {/* Row: Rank + Label + Count + Percentage */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 text-2xs font-medium text-lunar-text text-right shrink-0">
                      {index + 1}.
                    </span>
                    <span className="text-2xs text-lunar-text font-medium truncate flex-1 min-w-0">
                      {stat.label}
                    </span>
                    <Badge variant="secondary" className="text-2xs shrink-0">
                      {stat.count}
                    </Badge>
                    <span className="text-2xs text-lunar-textSecondary w-8 text-right shrink-0">
                      {stat.percentage}%
                    </span>
                  </div>
                  
                  {/* Bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-4 shrink-0" />
                    <div className="flex-1 h-1.5 bg-lunar-border/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-destructive transition-all duration-300"
                        style={{ 
                          width: `${barWidth}%`,
                          opacity: Math.max(opacity, 0.4)
                        }}
                      />
                    </div>
                    <div className="w-8 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
