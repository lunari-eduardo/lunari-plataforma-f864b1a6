import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RankedBarItem {
  name: string;
  value: number;
  percentage: number;
  secondary?: string; // e.g., "38 sessões"
}

interface RankedBarListProps {
  icon: React.ElementType;
  title: string;
  data: RankedBarItem[];
  maxItems?: number;
  showOthers?: boolean;
  valueFormatter?: (value: number) => string;
  colorClass?: string; // Tailwind color class for the bar, e.g., "bg-chart-primary"
}

export function RankedBarList({ 
  icon: Icon, 
  title, 
  data, 
  maxItems = 5, 
  showOthers = true,
  valueFormatter = (v) => v.toLocaleString('pt-BR'),
  colorClass = 'bg-chart-primary'
}: RankedBarListProps) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);
  
  // Sort by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  // Split into visible items and "others"
  const visibleItems = sortedData.slice(0, maxItems);
  const othersItems = sortedData.slice(maxItems);
  
  // Calculate "Outros" aggregation
  const othersTotal = othersItems.reduce((sum, item) => sum + item.value, 0);
  const othersPercentage = othersItems.reduce((sum, item) => sum + item.percentage, 0);
  const othersSessions = othersItems.reduce((sum, item) => {
    const sessions = item.secondary ? parseInt(item.secondary) : 0;
    return sum + sessions;
  }, 0);
  
  // Max value for proportional bar calculation
  const maxValue = Math.max(...sortedData.map(d => d.value), 1);

  return (
    <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <h3 className="text-xs font-medium text-lunar-text">{title}</h3>
        </div>
        
        {hasData ? (
          <div className="space-y-2">
            {visibleItems.map((item, index) => (
              <RankedBarItem
                key={item.name}
                rank={index + 1}
                name={item.name}
                value={item.value}
                percentage={item.percentage}
                secondary={item.secondary}
                maxValue={maxValue}
                valueFormatter={valueFormatter}
                colorClass={colorClass}
                opacity={1 - (index * 0.12)} // Gradual opacity reduction
              />
            ))}
            
            {/* "Outros" aggregation */}
            {showOthers && othersItems.length > 0 && (
              <RankedBarItem
                rank={visibleItems.length + 1}
                name={`Outros (${othersItems.length})`}
                value={othersTotal}
                percentage={othersPercentage}
                secondary={othersSessions > 0 ? `${othersSessions} sessões` : undefined}
                maxValue={maxValue}
                valueFormatter={valueFormatter}
                colorClass={colorClass}
                opacity={0.4}
                isOthers
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[140px]">
            <BarChart3 className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
            <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RankedBarItemProps {
  rank: number;
  name: string;
  value: number;
  percentage: number;
  secondary?: string;
  maxValue: number;
  valueFormatter: (value: number) => string;
  colorClass: string;
  opacity: number;
  isOthers?: boolean;
}

function RankedBarItem({
  rank,
  name,
  value,
  percentage,
  secondary,
  maxValue,
  valueFormatter,
  colorClass,
  opacity,
  isOthers = false
}: RankedBarItemProps) {
  const barWidth = Math.max((value / maxValue) * 100, 2); // Min 2% for visibility
  
  return (
    <div className="group">
      {/* Row: Rank + Name + Value + Percentage */}
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          "w-4 text-2xs font-medium text-right shrink-0",
          isOthers ? "text-lunar-textSecondary" : "text-lunar-text"
        )}>
          {rank}.
        </span>
        <span className={cn(
          "text-2xs truncate flex-1 min-w-0",
          isOthers ? "text-lunar-textSecondary italic" : "text-lunar-text font-medium"
        )}>
          {name}
        </span>
        <span className="text-2xs text-lunar-text font-medium shrink-0">
          {valueFormatter(value)}
        </span>
        <span className="text-2xs text-lunar-textSecondary w-8 text-right shrink-0">
          {percentage.toFixed(0)}%
        </span>
      </div>
      
      {/* Bar */}
      <div className="flex items-center gap-2">
        <div className="w-4 shrink-0" /> {/* Spacer for rank alignment */}
        <div className="flex-1 h-1.5 bg-lunar-border/30 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-300", colorClass)}
            style={{ 
              width: `${barWidth}%`,
              opacity 
            }}
          />
        </div>
        <div className="w-8 shrink-0" /> {/* Spacer for percentage alignment */}
      </div>
      
      {/* Secondary info (sessions) */}
      {secondary && (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-4 shrink-0" />
          <span className="text-2xs text-lunar-textSecondary">{secondary}</span>
        </div>
      )}
    </div>
  );
}
