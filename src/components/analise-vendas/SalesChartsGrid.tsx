import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Calendar, Camera, DollarSign, Package, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
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
    sessions: { label: 'Sessões', color: 'hsl(var(--chart-secondary))' },
    averageTicket: { label: 'Ticket Médio', color: 'hsl(var(--chart-tertiary))' },
    extraPhotoRevenue: { label: 'Fotos Extras', color: 'hsl(var(--chart-quaternary))' }
  };

  const PIE_COLORS = [
    'hsl(var(--chart-primary))',
    'hsl(var(--chart-secondary))',
    'hsl(var(--chart-tertiary))',
    'hsl(var(--chart-quaternary))',
    'hsl(var(--chart-quinary))',
    'hsl(var(--chart-senary))'
  ];

  // Check if data has meaningful values
  const hasRevenueData = monthlyData.some(d => d.revenue > 0);
  const hasSessionsData = monthlyData.some(d => d.sessions > 0);
  const hasTicketData = monthlyData.some(d => d.averageTicket > 0);
  const hasExtraData = monthlyData.some(d => d.extraPhotoRevenue > 0);

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
          <ChartContainer config={chartConfig} className="w-full h-[180px] lg:h-[200px]">
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [formatCurrency(value), 'Receita']}
              />
              <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        {/* Sessões por Mês */}
        <ChartCard 
          icon={Calendar} 
          title="Sessões por Mês"
          hasData={hasSessionsData}
        >
          <ChartContainer config={chartConfig} className="w-full h-[180px] lg:h-[200px]">
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: any) => [`${value} sessões`, 'Quantidade']}
              />
              <Bar dataKey="sessions" fill="url(#sessionsGradient)" radius={[4, 4, 0, 0]} />
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
          <ChartContainer config={chartConfig} className="w-full h-[180px] lg:h-[200px]">
            <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(1)}k` : '0'}
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
          <ChartContainer config={chartConfig} className="w-full h-[180px] lg:h-[200px]">
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
                fontSize={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
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
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* Row 3: Donuts - Categoria, Origem, Pacote */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Categoria */}
        <DonutCard 
          icon={PieChartIcon}
          title="Por Categoria"
          data={categoryData}
          dataKey="percentage"
          colors={PIE_COLORS}
          formatTooltip={(value: any, props: any) => 
            `${value.toFixed(1)}% (${formatCurrency(props.payload.revenue)})`
          }
        />

        {/* Origem */}
        <OriginDonutCard originData={originData} />

        {/* Pacote */}
        <DonutCard 
          icon={Package}
          title={selectedCategory === 'all' ? 'Por Pacote' : `Pacotes`}
          data={packageDistributionData}
          dataKey="percentage"
          colors={PIE_COLORS}
          formatTooltip={(value: any, props: any) => 
            `${value.toFixed(1)}% - ${props.payload.sessions} sessões`
          }
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
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <h3 className="text-xs font-medium text-lunar-text">{title}</h3>
        </div>
        
        {hasData ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px] lg:h-[200px]">
            <BarChart3 className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
            <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact Donut Card Component
interface DonutCardProps {
  icon: React.ElementType;
  title: string;
  data: any[];
  dataKey: string;
  colors: string[];
  formatTooltip: (value: any, props: any) => string;
}

function DonutCard({ icon: Icon, title, data, dataKey, colors, formatTooltip }: DonutCardProps) {
  const hasData = data && data.length > 0 && data.some(d => d[dataKey] > 0);
  
  // Get top item for center label
  const topItem = hasData ? data.reduce((a, b) => a[dataKey] > b[dataKey] ? a : b) : null;
  
  return (
    <Card className="border border-lunar-border/30 bg-lunar-surface/50 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <h3 className="text-xs font-medium text-lunar-text">{title}</h3>
        </div>
        
        {hasData ? (
          <div className="flex flex-col items-center">
            <div className="w-[140px] h-[140px] relative">
              <ChartContainer config={{}} className="w-full h-full">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    cornerRadius={8}
                    dataKey={dataKey}
                  >
                    {data.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: any, name: any, props: any) => [
                      formatTooltip(value, props),
                      ''
                    ]}
                  />
                </PieChart>
              </ChartContainer>
              
              {/* Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-lunar-text">
                  {topItem?.[dataKey]?.toFixed(0)}%
                </span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-2 space-y-1 w-full max-h-[80px] overflow-y-auto">
              {data.slice(0, 4).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-2xs">
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <span className="text-lunar-textSecondary truncate max-w-[80px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-lunar-text font-medium">
                    {item[dataKey]?.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px]">
            <PieChartIcon className="h-6 w-6 text-lunar-textSecondary/40 mb-1" />
            <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
