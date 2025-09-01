import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/financialUtils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// Paleta para gráficos de barras/linhas (apenas cor principal)
const BAR_LINE_COLORS = ['hsl(var(--chart-primary))'];

// Paleta personalizada para gráficos de pizza/donut (10 cores sequenciais)
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

interface GraficosFinanceirosProps {
  dadosMensais: any[];
  composicaoDespesas: any[];
  evolucaoCategoria: any[];
  categoriaSelecionada: string;
  roiData: {
    totalInvestimento: number;
    roi: number;
  };
  categoriasDetalhadas?: any[];
}

const GraficosFinanceiros = memo(function GraficosFinanceiros({
  dadosMensais,
  composicaoDespesas,
  evolucaoCategoria,
  categoriaSelecionada,
  roiData,
  categoriasDetalhadas = []
}: GraficosFinanceirosProps) {
  return (
    <>
      {/* Gráfico Principal - Receita vs Lucro */}
      <section aria-label="Gráfico Principal" className="animate-fade-in">
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Receita vs Lucro Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dadosMensais} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                   <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      formatCurrency(value), 
                      name === 'receita' ? 'Receita' : name === 'lucro' ? 'Lucro' : name
                    ]} 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="receita" fill="hsl(var(--chart-revenue))" radius={[4, 4, 0, 0]} name="Receita" />
                  <Bar dataKey="lucro" fill="hsl(var(--chart-primary))" radius={[4, 4, 0, 0]} name="Lucro" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Gráficos Complementares - Linha 1 */}
      <section aria-label="Gráficos Complementares" className="animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ROI - Retorno sobre Investimento */}
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">ROI - Retorno sobre Investimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-chart-primary mb-2">
                    {roiData.roi.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Retorno sobre Investimento</p>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Investimento Total:</span>
                    <span className="font-medium">{formatCurrency(roiData.totalInvestimento)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Retorno Calculado:</span>
                    <span className="font-medium text-chart-primary">
                      {formatCurrency(roiData.totalInvestimento * (roiData.roi / 100))}
                    </span>
                  </div>
                </div>
                {/* Indicador Visual do ROI */}
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-chart-primary to-chart-secondary h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, roiData.roi))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Composição de Despesas */}
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Composição das Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={composicaoDespesas} 
                      cx="50%" 
                      cy="50%" 
                      labelLine={false} 
                      label={({ grupo, percentual }) => `${grupo}: ${percentual.toFixed(1)}%`} 
                      outerRadius={80} 
                      fill="#8884d8" 
                      dataKey="valor"
                    >
                      {composicaoDespesas.map((_, index) => 
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      )}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatCurrency(value), '']} contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Evolução de Categoria */}
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">
                Evolução: {categoriaSelecionada || 'Selecione uma categoria'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={evolucaoCategoria} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value: any) => [formatCurrency(value), '']} contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Gráfico de Fluxo de Caixa - Linha 2 */}
      <section aria-label="Fluxo de Caixa" className="animate-fade-in">
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Fluxo de Caixa Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosMensais.map((item, index) => ({
                  ...item,
                  saldoAcumulado: dadosMensais.slice(0, index + 1).reduce((acc, curr) => acc + curr.lucro, 0)
                }))} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFluxoCaixa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-tertiary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-tertiary))" stopOpacity={0.1} />
                    </linearGradient>
                   </defs>
                   <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), 'Saldo Acumulado']} 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area type="monotone" dataKey="saldoAcumulado" stroke="hsl(var(--chart-tertiary))" fillOpacity={1} fill="url(#colorFluxoCaixa)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Despesas por Categoria Detalhada - Se houver dados */}
      {categoriasDetalhadas.length > 0 && (
        <section aria-label="Despesas por Categoria" className="animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={categoriasDetalhadas} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <XAxis
                      dataKey="categoria" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-quaternary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </>
  );
});

export default GraficosFinanceiros;