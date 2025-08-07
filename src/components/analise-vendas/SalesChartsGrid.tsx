import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Camera, DollarSign, Package } from 'lucide-react';
import { MonthlyData, CategoryData, PackageDistributionData, OriginData } from '@/hooks/useSalesAnalytics';
import { OriginChartsSection } from './OriginChartsSection';
import { MonthlyOriginData } from '@/services/RevenueAnalyticsService';

interface SalesChartsGridProps {
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  packageDistributionData: PackageDistributionData[];
  originData: OriginData[];
  monthlyOriginData: MonthlyOriginData[];
  selectedCategory: string;
}

export function SalesChartsGrid({ monthlyData, categoryData, packageDistributionData, originData, monthlyOriginData, selectedCategory }: SalesChartsGridProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Monthly Revenue Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Receita Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Receita']}
              />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--chart-primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Sessions per Month Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Sessões por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [`${value} sessões`, 'Quantidade']}
              />
              <Bar
                dataKey="sessions"
                fill="hsl(var(--chart-tertiary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Average Ticket Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Ticket Médio por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Ticket Médio']}
              />
              <Line
                type="monotone"
                dataKey="averageTicket"
                stroke="hsl(var(--chart-revenue))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--chart-revenue))', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Extra Photos Revenue Chart */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Camera className="h-4 w-4 text-orange-500" />
            Receita Fotos Extras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Receita Extra']}
              />
              <Area
                type="monotone"
                dataKey="extraPhotoRevenue"
                stroke="hsl(var(--chart-quaternary))"
                fill="hsl(var(--chart-quaternary))"
                fillOpacity={0.4}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Package Distribution */}
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-500" />
            {selectedCategory === 'all' ? 'Distribuição por Pacote' : `Pacotes em ${selectedCategory}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <PieChart>
              <Pie
                data={packageDistributionData}
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
                {packageDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

      {/* Origin Charts */}
      <OriginChartsSection originData={originData} monthlyOriginData={monthlyOriginData} />

      {/* Category Distribution */}
      <Card className="border-0 shadow-lg bg-lunar-surface lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-500" />
            Distribuição por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[280px]">
            <PieChart>
              <Pie
                data={categoryData}
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
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any, name: any, props: any) => [
                  `${value.toFixed(1)}% (${formatCurrency(props.payload.revenue)})`,
                  'Participação'
                ]}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

    </div>
  );
}