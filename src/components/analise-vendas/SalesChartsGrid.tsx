import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Calendar, Camera, DollarSign, Package, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { MonthlyData, CategoryData, PackageDistributionData, OriginData } from '@/hooks/useSalesAnalytics';
import { OriginChartsSection } from './OriginChartsSection';
import { OriginHighlightCard } from './OriginHighlightCard';
import { RankedBarList, RankedBarItem } from './RankedBarList';
import { MonthlyOriginData } from '@/services/RevenueAnalyticsService';
import { SalesComparisonResult } from '@/domain/sales/sales-domain';

interface SalesChartsGridProps {
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  packageDistributionData: PackageDistributionData[];
  originData: OriginData[];
  monthlyOriginData: MonthlyOriginData[];
  selectedCategory: string;
  comparison?: SalesComparisonResult | null;
  baseYear: number;
}

export function SalesChartsGrid({ monthlyData, categoryData, packageDistributionData, originData, monthlyOriginData, selectedCategory, comparison, baseYear }: SalesChartsGridProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const comparisonActive = !!comparison;
  const comparisonYear = comparison?.comparisonYear;

  // Merge monthly data with comparison data when active
  const mergedMonthly = monthlyData.map((d, idx) => {
    const prev = comparison?.monthlyData[idx];
    return {
      ...d,
      revenuePrevious: prev?.revenuePrevious ?? 0,
      sessionsPrevious: prev?.sessionsPrevious ?? 0,
      averageTicketPrevious: prev?.averageTicketPrevious ?? 0,
      extraPhotoRevenuePrevious: prev?.extraPhotoRevenuePrevious ?? 0
    };
  });

  const chartConfig = {
    revenue: { label: `Receita ${baseYear}`, color: 'hsl(var(--chart-primary))' },
    revenuePrevious: { label: `Receita ${comparisonYear ?? ''}`, color: 'hsl(var(--muted-foreground))' },
    sessions: { label: `Sessões ${baseYear}`, color: 'hsl(var(--chart-secondary))' },
    sessionsPrevious: { label: `Sessões ${comparisonYear ?? ''}`, color: 'hsl(var(--muted-foreground))' },
    averageTicket: { label: `Ticket ${baseYear}`, color: 'hsl(var(--chart-tertiary))' },
    averageTicketPrevious: { label: `Ticket ${comparisonYear ?? ''}`, color: 'hsl(var(--muted-foreground))' },
    extraPhotoRevenue: { label: `Extras ${baseYear}`, color: 'hsl(var(--chart-quaternary))' },
    extraPhotoRevenuePrevious: { label: `Extras ${comparisonYear ?? ''}`, color: 'hsl(var(--muted-foreground))' }
  };

  // Check if data has meaningful values
  const hasRevenueData = monthlyData.some(d => d.revenue > 0) || (comparisonActive && mergedMonthly.some(d => d.revenuePrevious > 0));
  const hasSessionsData = monthlyData.some(d => d.sessions > 0) || (comparisonActive && mergedMonthly.some(d => d.sessionsPrevious > 0));
  const hasTicketData = monthlyData.some(d => d.averageTicket > 0) || (comparisonActive && mergedMonthly.some(d => d.averageTicketPrevious > 0));
  const hasExtraData = monthlyData.some(d => d.extraPhotoRevenue > 0) || (comparisonActive && mergedMonthly.some(d => d.extraPhotoRevenuePrevious > 0));

  // Transform data for RankedBarList
  const categoryBarData: RankedBarItem[] = categoryData.map(cat => ({
    name: cat.name,
    value: cat.revenue,
    percentage: cat.percentage,
    secondary: `${cat.sessions} sessões`
  }));

  const packageBarData: RankedBarItem[] = packageDistributionData.map(pkg => ({
    name: pkg.name,
    value: pkg.revenue,
    percentage: pkg.percentage,
    secondary: `${pkg.sessions} sessões`
  }));

  return (
    <div className="space-y-4">
      {/* Row 1: Receita + Sessões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receita Mensal */}
        <ChartCard 
          icon={DollarSign} 
          title="Receita Mensal"
          hasData={hasRevenueData}
        >
          <ChartContainer config={chartConfig} className="w-full h-[200px] lg:h-[225px]">
            <BarChart data={mergedMonthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-primary))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--chart-primary))" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
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
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent hideIndicator />}
                formatter={(value: any) => formatCurrency(value)}
              />
              {comparisonActive && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />}
              {comparisonActive && (
                <Bar dataKey="revenuePrevious" name={`${comparisonYear}`} fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
              )}
              <Bar dataKey="revenue" name={`${baseYear}`} fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        {/* Sessões por Mês */}
        <ChartCard 
          icon={Calendar} 
          title="Sessões por Mês"
          hasData={hasSessionsData}
        >
          <ChartContainer config={chartConfig} className="w-full h-[200px] lg:h-[225px]">
            <BarChart data={mergedMonthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-secondary))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--chart-secondary))" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
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
                content={<ChartTooltipContent hideIndicator />}
                formatter={(value: any) => `${value} sessões`}
              />
              {comparisonActive && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />}
              {comparisonActive && (
                <Bar dataKey="sessionsPrevious" name={`${comparisonYear}`} fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
              )}
              <Bar dataKey="sessions" name={`${baseYear}`} fill="url(#sessionsGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* Row 2: Ticket Médio + Fotos Extras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ticket Médio */}
        <ChartCard 
          icon={TrendingUp} 
          title="Ticket Médio"
          hasData={hasTicketData}
        >
          <ChartContainer config={chartConfig} className="w-full h-[200px] lg:h-[225px]">
            <LineChart data={mergedMonthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
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
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(1)}k` : '0'}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent hideIndicator />}
                formatter={(value: any) => formatCurrency(value)}
              />
              {comparisonActive && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />}
              {comparisonActive && (
                <Line
                  type="monotone"
                  dataKey="averageTicketPrevious"
                  name={`${comparisonYear}`}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="averageTicket"
                name={`${baseYear}`}
                stroke="hsl(var(--chart-tertiary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-tertiary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--chart-tertiary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        {/* Fotos Extras */}
        <ChartCard 
          icon={Camera} 
          title="Receita Fotos Extras"
          hasData={hasExtraData}
        >
          <ChartContainer config={chartConfig} className="w-full h-[200px] lg:h-[225px]">
            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="extraGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-quaternary))" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="hsl(var(--chart-quaternary))" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
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
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent hideIndicator />}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="extraPhotoRevenue"
                stroke="hsl(var(--chart-quaternary))"
                fill="url(#extraGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* Row 3: Ranked Bar Lists - Categoria, Origem, Pacote */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Categoria */}
        <RankedBarList
          icon={PieChartIcon}
          title="Por Categoria"
          data={categoryBarData}
          maxItems={4}
          showOthers={true}
          valueFormatter={formatCurrency}
          colorClass="bg-chart-primary"
        />

        {/* Origem - Card especial ou lista */}
        <OriginHighlightCard originData={originData} />

        {/* Pacote */}
        <RankedBarList
          icon={Package}
          title={selectedCategory === 'all' ? 'Por Pacote' : 'Pacotes'}
          data={packageBarData}
          maxItems={5}
          showOthers={true}
          valueFormatter={formatCurrency}
          colorClass="bg-chart-secondary"
        />
      </div>

      {/* Row 4: Origin Summary + Timeline */}
      <OriginChartsSection originData={originData} monthlyOriginData={monthlyOriginData} />
    </div>
  );
}

// Compact Chart Card Component
interface ChartCardProps {
  icon: React.ElementType;
  title: string;
  hasData: boolean;
  children: React.ReactNode;
}

function ChartCard({ icon: Icon, title, hasData, children }: ChartCardProps) {
  return (
    <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon className="h-4 w-4 text-lunar-textSecondary" />
          <h3 className="text-sm font-medium text-lunar-text">{title}</h3>
        </div>
        
        {hasData ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] lg:h-[225px]">
            <BarChart3 className="h-7 w-7 text-lunar-textSecondary/40 mb-1.5" />
            <p className="text-xs text-lunar-textSecondary">Sem dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
