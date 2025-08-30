import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Camera, DollarSign, Package } from 'lucide-react';
import { MonthlyData, CategoryData, PackageDistributionData, OriginData } from '@/hooks/useSalesAnalytics';
import { OriginChartsSection } from './OriginChartsSection';
import { OriginDonutCard } from './OriginDonutCard';
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

  // Paleta personalizada para gráficos de pizza/donut (10 cores)
  const PIE_COLORS = [
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly Revenue Chart */}
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-gradient">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            Receita Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full aspect-auto h-[220px] sm:h-[260px] lg:h-[300px]">
            <BarChart data={monthlyData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-primary))" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="hsl(var(--chart-primary))" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="hsl(var(--chart-primary))" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Receita']}
              />
              <Bar
                dataKey="revenue"
                fill="url(#revenueGradient)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Sessions per Month Chart */}
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-gradient">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            Sessões por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[220px] sm:h-[260px] lg:h-[300px]">
            <BarChart data={monthlyData}>
              <defs>
                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-secondary))" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="hsl(var(--chart-secondary))" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="hsl(var(--chart-secondary))" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [`${value} sessões`, 'Quantidade']}
              />
              <Bar
                dataKey="sessions"
                fill="url(#sessionsGradient)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Average Ticket Chart */}
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-gradient">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            Ticket Médio por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[220px] sm:h-[260px] lg:h-[300px]">
            <LineChart data={monthlyData}>
              <defs>
                <radialGradient id="ticketDotGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--chart-tertiary))" stopOpacity="1" />
                  <stop offset="100%" stopColor="hsl(var(--chart-tertiary))" stopOpacity="0.7" />
                </radialGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Ticket Médio']}
              />
              <Line
                type="monotone"
                dataKey="averageTicket"
                stroke="hsl(var(--chart-tertiary))"
                strokeWidth={3}
                dot={{ fill: 'url(#ticketDotGradient)', strokeWidth: 0, r: 6 }}
                activeDot={{ fill: 'hsl(var(--chart-tertiary))', strokeWidth: 2, r: 8, stroke: 'hsl(var(--chart-quaternary))' }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Extra Photos Revenue Chart */}
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-gradient">
              <Camera className="h-4 w-4 text-white" />
            </div>
            Receita Fotos Extras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[220px] sm:h-[260px] lg:h-[300px]">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="extraGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-quaternary))" stopOpacity="0.7" />
                  <stop offset="50%" stopColor="hsl(var(--chart-quaternary))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--chart-quaternary))" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Receita Extra']}
              />
              <Area
                type="monotone"
                dataKey="extraPhotoRevenue"
                stroke="hsl(var(--chart-quaternary))"
                fill="url(#extraGradient)"
                fillOpacity={1}
                strokeWidth={3}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Donut Charts: Category, Origin, Package */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch lg:col-span-2">
        {/* Category Distribution */}
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
              <div className="p-2 rounded-lg bg-brand-gradient">
                <PieChartIcon className="h-4 w-4 text-white" />
              </div>
              Distribuição por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  cornerRadius={16}
                  dataKey="percentage"
                  label={({ name, percentage }) => 
                    percentage > 8 ? `${name} ${percentage.toFixed(0)}%` : ''
                  }
                  labelLine={false}
                  fontSize={10}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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

        {/* Origin Distribution */}
        <OriginDonutCard originData={originData} />

        {/* Package Distribution */}
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
              <div className="p-2 rounded-lg bg-brand-gradient">
                <Package className="h-4 w-4 text-white" />
              </div>
              {selectedCategory === 'all' ? 'Distribuição por Pacote' : `Pacotes em ${selectedCategory}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto">
              <PieChart>
                <Pie
                  data={packageDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  cornerRadius={16}
                  dataKey="percentage"
                  label={({ name, percentage }) => 
                    percentage > 8 ? `${name} ${percentage.toFixed(0)}%` : ''
                  }
                  labelLine={false}
                  fontSize={10}
                >
                  {packageDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
      </div>

      {/* Origin Summary + Timeline */}
      <OriginChartsSection originData={originData} monthlyOriginData={monthlyOriginData} />

    </div>
  );
}