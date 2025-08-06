import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar } from 'lucide-react';

export function SalesChartsGrid() {
  // Mock data para os gráficos
  const revenueData = [
    { month: 'Jan', revenue: 28500, goal: 30000 },
    { month: 'Fev', revenue: 32100, goal: 30000 },
    { month: 'Mar', revenue: 29800, goal: 30000 },
    { month: 'Abr', revenue: 35200, goal: 35000 },
    { month: 'Mai', revenue: 41300, goal: 40000 },
    { month: 'Jun', revenue: 38900, goal: 40000 },
    { month: 'Jul', revenue: 45200, goal: 45000 },
    { month: 'Ago', revenue: 42800, goal: 45000 },
    { month: 'Set', revenue: 48100, goal: 48000 },
    { month: 'Out', revenue: 52300, goal: 50000 },
    { month: 'Nov', revenue: 45800, goal: 50000 },
    { month: 'Dez', revenue: 48500, goal: 50000 }
  ];

  const serviceData = [
    { name: 'Ensaio Casal', value: 35, revenue: 15800 },
    { name: 'Casamento', value: 25, revenue: 12500 },
    { name: 'Ensaio Família', value: 20, revenue: 9200 },
    { name: 'Gestante', value: 15, revenue: 6800 },
    { name: 'Corporativo', value: 5, revenue: 2400 }
  ];

  const conversionData = [
    { period: 'Jan', orcamentos: 45, vendas: 28, taxa: 62 },
    { period: 'Fev', orcamentos: 52, vendas: 35, taxa: 67 },
    { period: 'Mar', orcamentos: 48, vendas: 31, taxa: 65 },
    { period: 'Abr', orcamentos: 58, vendas: 42, taxa: 72 },
    { period: 'Mai', orcamentos: 62, vendas: 45, taxa: 73 },
    { period: 'Jun', orcamentos: 55, vendas: 38, taxa: 69 }
  ];

  const monthlyGrowthData = [
    { month: 'Jan', crescimento: 5.2 },
    { month: 'Fev', crescimento: 12.8 },
    { month: 'Mar', crescimento: -7.1 },
    { month: 'Abr', crescimento: 18.1 },
    { month: 'Mai', crescimento: 17.3 },
    { month: 'Jun', crescimento: -5.8 },
    { month: 'Jul', crescimento: 16.2 },
    { month: 'Ago', crescimento: -5.3 },
    { month: 'Set', crescimento: 12.4 },
    { month: 'Out', crescimento: 8.7 },
    { month: 'Nov', crescimento: -12.4 },
    { month: 'Dez', crescimento: 5.9 }
  ];

  const chartConfig = {
    revenue: { label: 'Receita', color: 'hsl(var(--chart-primary))' },
    goal: { label: 'Meta', color: 'hsl(var(--chart-secondary))' },
    orcamentos: { label: 'Orçamentos', color: 'hsl(var(--chart-tertiary))' },
    vendas: { label: 'Vendas', color: 'hsl(var(--chart-primary))' },
    crescimento: { label: 'Crescimento %', color: 'hsl(var(--chart-revenue))' }
  };

  const COLORS = [
    'hsl(var(--chart-primary))',
    'hsl(var(--chart-secondary))',
    'hsl(var(--chart-tertiary))',
    'hsl(var(--chart-quaternary))',
    'hsl(var(--chart-quinary))'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      {/* Revenue vs Goals Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Receita vs Meta Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] md:h-[300px]">
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [`R$ ${value.toLocaleString()}`, 'Valor']}
              />
              <Area
                type="monotone"
                dataKey="goal"
                stroke="hsl(var(--chart-secondary))"
                fill="hsl(var(--chart-secondary))"
                fillOpacity={0.2}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-primary))"
                fill="hsl(var(--chart-primary))"
                fillOpacity={0.3}
                strokeWidth={3}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Service Distribution */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-500" />
            Distribuição por Serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] md:h-[250px]">
            <PieChart>
              <Pie
                data={serviceData}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={9}
              >
                {serviceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any, name: any, props: any) => [
                  `${value}% (R$ ${props.payload.revenue.toLocaleString()})`,
                  'Participação'
                ]}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            Funil de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] md:h-[250px]">
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="period" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orcamentos" fill="hsl(var(--chart-tertiary))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="vendas" fill="hsl(var(--chart-primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Growth */}
      <Card className="border-0 shadow-lg bg-lunar-surface lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-500" />
            Crescimento Mensal (%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px]">
            <LineChart data={monthlyGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [`${value}%`, 'Crescimento']}
              />
              <Line
                type="monotone"
                dataKey="crescimento"
                stroke="hsl(var(--chart-revenue))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--chart-revenue))', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}