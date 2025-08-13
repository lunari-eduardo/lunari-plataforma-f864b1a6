import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { MonthlyOriginData } from '@/services/RevenueAnalyticsService';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';

interface OriginTimelineChartProps {
  monthlyOriginData: MonthlyOriginData[];
}

export function OriginTimelineChart({ monthlyOriginData }: OriginTimelineChartProps) {
  // Identificar origens ativas (que têm pelo menos uma sessão)
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

  // Configurar cores para as linhas
  const chartConfig = originsList.reduce((config, originId) => {
    const matchingOrigin = ORIGENS_PADRAO.find(o => o.id === originId);
    const color = matchingOrigin?.cor || '#6B7280';
    
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
        <div className="bg-lunar-surface border border-lunar-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-lunar-text mb-2">{label}</p>
          {payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-lunar-text">
                  {entry.name}: {entry.value} sessões
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
      <Card className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Timeline de Sessões por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-xs text-lunar-textSecondary">Nenhum dado de origem disponível para exibir a timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          Timeline de Sessões por Origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full h-[300px] sm:h-[340px] lg:h-[380px]">
          <LineChart data={monthlyOriginData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 11, fill: 'hsl(var(--lunar-textSecondary))' }}
              axisLine={{ stroke: 'hsl(var(--lunar-border))' }}
              tickLine={{ stroke: 'hsl(var(--lunar-border))' }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: 'hsl(var(--lunar-textSecondary))' }}
              axisLine={{ stroke: 'hsl(var(--lunar-border))' }}
              tickLine={{ stroke: 'hsl(var(--lunar-border))' }}
              label={{ 
                value: 'Sessões', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fontSize: '11px', fill: 'hsl(var(--lunar-textSecondary))' }
              }}
            />
            
            {originsList.map((originId) => (
              <Line
                key={originId}
                type="monotone"
                dataKey={originId}
                stroke={chartConfig[originId]?.color || '#6B7280'}
                strokeWidth={2}
                dot={{ fill: chartConfig[originId]?.color || '#6B7280', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: chartConfig[originId]?.color || '#6B7280', strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
            
            <ChartTooltip content={<CustomTooltip />} />
            
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}
              formatter={(value) => (
                <span style={{ color: 'hsl(var(--lunar-text))' }}>
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