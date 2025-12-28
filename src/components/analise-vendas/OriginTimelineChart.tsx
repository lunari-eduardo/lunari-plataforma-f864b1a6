import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Legend } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { MonthlyOriginData } from '@/services/RevenueAnalyticsService';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';

interface OriginTimelineChartProps {
  monthlyOriginData: MonthlyOriginData[];
}

export function OriginTimelineChart({ monthlyOriginData }: OriginTimelineChartProps) {
  // Identify active origins
  const activeOrigins = new Set<string>();
  monthlyOriginData.forEach(monthData => {
    Object.keys(monthData).forEach(key => {
      if (key !== 'month' && key !== 'monthIndex' && key !== 'totalSessions') {
        const sessions = monthData[key] as number;
        if (sessions > 0) {
          activeOrigins.add(key);
        }
      }
    });
  });

  const originsList = Array.from(activeOrigins);

  const monochromaticColors = [
    'hsl(var(--chart-primary))',
    'hsl(var(--chart-secondary))',
    'hsl(var(--chart-tertiary))',
    'hsl(var(--chart-quaternary))',
    'hsl(var(--chart-quinary))',
    'hsl(var(--chart-senary))'
  ];

  const chartConfig = originsList.reduce((config, originId, index) => {
    const matchingOrigin = ORIGENS_PADRAO.find(o => o.id === originId);
    const color = monochromaticColors[index % monochromaticColors.length];
    
    config[originId] = {
      label: matchingOrigin?.nome || (originId === 'nao-especificado' ? 'Não especificado' : originId),
      color
    };
    
    return config;
  }, {} as Record<string, { label: string; color: string }>);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-lunar-surface border border-lunar-border rounded-lg p-2 shadow-lg">
          <p className="text-xs font-medium text-lunar-text mb-1">{label}</p>
          {payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .slice(0, 5)
            .map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-1.5 text-2xs">
                <div 
                  className="w-1.5 h-1.5 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-lunar-textSecondary">
                  {chartConfig[entry.dataKey]?.label || entry.name}: {entry.value}
                </span>
              </div>
            ))}
        </div>
      );
    }
    return null;
  };

  if (originsList.length === 0) {
    return (
      <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-lunar-textSecondary" />
            <h3 className="text-xs font-medium text-lunar-text">Timeline por Origem</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-[200px]">
            <BarChart3 className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
            <p className="text-2xs text-lunar-textSecondary">Sem dados para timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <h3 className="text-xs font-medium text-lunar-text">Timeline por Origem</h3>
        </div>
        
        <ChartContainer config={chartConfig} className="w-full h-[200px] lg:h-[240px]">
          <LineChart data={monthlyOriginData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            
            {originsList.map((originId) => (
              <Line
                key={originId}
                type="monotone"
                dataKey={originId}
                stroke={chartConfig[originId]?.color || 'hsl(var(--muted-foreground))'}
                strokeWidth={2}
                dot={{ fill: chartConfig[originId]?.color || 'hsl(var(--muted-foreground))', strokeWidth: 0, r: 2 }}
                activeDot={{ 
                  r: 4, 
                  stroke: chartConfig[originId]?.color || 'hsl(var(--muted-foreground))', 
                  strokeWidth: 2,
                  fill: 'hsl(var(--lunar-surface))'
                }}
                connectNulls={false}
              />
            ))}
            
            <ChartTooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
              formatter={(value) => (
                <span className="text-lunar-textSecondary text-2xs">
                  {chartConfig[value]?.label || value}
                </span>
              )}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
