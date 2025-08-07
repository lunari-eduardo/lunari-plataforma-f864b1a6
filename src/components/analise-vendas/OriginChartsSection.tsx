import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Globe, TrendingUp } from 'lucide-react';
import { OriginData } from '@/types/salesAnalytics';

interface OriginChartsSectionProps {
  originData: OriginData[];
}

export function OriginChartsSection({ originData }: OriginChartsSectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const chartConfig = {
    origem: { label: 'Origem', color: 'hsl(var(--chart-primary))' }
  };

  return (
    <>
      {/* Origin Distribution Pie Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-500" />
            Distribuição por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <PieChart>
              <Pie
                data={originData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="percentage"
                label={({ name, percentage }) => 
                  percentage > 5 ? `${name} ${percentage.toFixed(0)}%` : ''
                }
                labelLine={false}
                fontSize={11}
              >
                {originData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any, name: any, props: any) => [
                  `${value.toFixed(1)}% - ${props.payload.sessions} sessões - ${formatCurrency(props.payload.revenue)}`,
                  ''
                ]}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Origin Summary Table */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
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
    </>
  );
}