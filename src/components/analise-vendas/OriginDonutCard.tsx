import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import { Globe } from 'lucide-react';
import { OriginData } from '@/types/salesAnalytics';

interface OriginDonutCardProps {
  originData: OriginData[];
}

export function OriginDonutCard({ originData }: OriginDonutCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const chartConfig = {
    origem: { label: 'Origem', color: 'hsl(var(--chart-primary))' },
  } as const;

  return (
    <Card className="rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <Globe className="h-4 w-4 text-emerald-500" />
          Distribuição por Origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto">
          <PieChart>
            <Pie
              data={originData}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={2}
              cornerRadius={16}
              dataKey="percentage"
              label={({ name, percentage }) => (percentage > 8 ? `${name} ${percentage.toFixed(0)}%` : '')}
              labelLine={false}
              fontSize={10}
            >
              {originData.map((entry, index) => {
                // Usar paleta personalizada completa para gráficos de pizza/donut
                const pieColors = [
                  'hsl(var(--chart-primary))',
                  'hsl(var(--chart-secondary))',
                  'hsl(var(--chart-tertiary))',
                  'hsl(var(--chart-quaternary))',
                  'hsl(var(--chart-quinary))',
                  'hsl(var(--chart-senary))',
                  'hsl(var(--chart-7))',
                  'hsl(var(--chart-8))',
                  'hsl(var(--chart-9))',
                  'hsl(var(--chart-10))'
                ];
                return (
                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                );
              })}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(value: any, name: any, props: any) => [
                `${value.toFixed(1)}% - ${props.payload.sessions} sessões - ${formatCurrency(props.payload.revenue)}`,
                '',
              ]}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
