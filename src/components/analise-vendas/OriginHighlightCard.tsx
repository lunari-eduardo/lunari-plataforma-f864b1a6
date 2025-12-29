import { Card, CardContent } from '@/components/ui/card';
import { Globe, MapPin, BarChart3 } from 'lucide-react';
import { OriginData } from '@/types/salesAnalytics';
import { RankedBarList, RankedBarItem } from './RankedBarList';

interface OriginHighlightCardProps {
  originData: OriginData[];
}

export function OriginHighlightCard({ originData }: OriginHighlightCardProps) {
  const hasData = originData && originData.length > 0 && originData.some(d => d.percentage > 0);
  
  if (!hasData) {
    return (
      <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-3.5 w-3.5 text-lunar-textSecondary" />
            <h3 className="text-xs font-medium text-lunar-text">Distribuição por Origem</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-[140px]">
            <BarChart3 className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
            <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by percentage descending
  const sortedData = [...originData].sort((a, b) => b.percentage - a.percentage);
  const topOrigin = sortedData[0];
  const isDominant = topOrigin.percentage >= 70;

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // If dominant origin (>70%), show highlight card
  if (isDominant) {
    const otherOrigins = sortedData.slice(1).filter(o => o.percentage > 0);
    const othersText = otherOrigins
      .slice(0, 3)
      .map(o => `${o.name} (${o.percentage.toFixed(0)}%)`)
      .join(', ');

    return (
      <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-3.5 w-3.5 text-lunar-textSecondary" />
            <h3 className="text-xs font-medium text-lunar-text">Origem Principal</h3>
          </div>
          
          {/* Highlight Section */}
          <div className="flex flex-col items-center py-4 px-2">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-chart-primary" />
              <span className="text-base font-semibold text-lunar-text">
                {topOrigin.name}
              </span>
            </div>
            
            <div className="text-2xl font-bold text-chart-primary mb-1">
              {topOrigin.percentage.toFixed(0)}%
            </div>
            
            <p className="text-2xs text-lunar-textSecondary mb-1">
              do faturamento
            </p>
            
            <div className="flex items-center gap-2 text-2xs text-lunar-text">
              <span>{formatCurrency(topOrigin.revenue)}</span>
              <span className="text-lunar-textSecondary">•</span>
              <span>{topOrigin.sessions} sessões</span>
            </div>
          </div>
          
          {/* Other Origins */}
          {otherOrigins.length > 0 && (
            <div className="pt-3 border-t border-lunar-border/30">
              <p className="text-2xs text-lunar-textSecondary">
                <span className="font-medium">Outras origens:</span> {othersText}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // If not dominant, use RankedBarList
  const barListData: RankedBarItem[] = sortedData.map(origin => ({
    name: origin.name,
    value: origin.revenue,
    percentage: origin.percentage,
    secondary: `${origin.sessions} sessões`
  }));

  return (
    <RankedBarList
      icon={Globe}
      title="Distribuição por Origem"
      data={barListData}
      maxItems={4}
      showOthers={true}
      valueFormatter={formatCurrency}
      colorClass="bg-chart-tertiary"
    />
  );
}
