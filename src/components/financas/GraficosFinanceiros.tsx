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
}

const GraficosFinanceiros = memo(function GraficosFinanceiros({
  dadosMensais,
  composicaoDespesas,
  evolucaoCategoria,
  categoriaSelecionada
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
                <AreaChart data={dadosMensais} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-revenue))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-revenue))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} formatter={(value: any) => [formatCurrency(value), '']} />
                  <Area type="monotone" dataKey="receita" stroke="hsl(var(--chart-revenue))" fillOpacity={1} fill="url(#colorReceita)" strokeWidth={2} />
                  <Area type="monotone" dataKey="lucro" stroke="hsl(var(--chart-primary))" fillOpacity={1} fill="url(#colorLucro)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Gráficos Complementares */}
      <section aria-label="Gráficos Complementares" className="animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Composição de Despesas */}
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Composição das Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={composicaoDespesas} cx="50%" cy="50%" labelLine={false} label={({ name, percentual }) => `${name}: ${percentual.toFixed(1)}%`} outerRadius={80} fill="#8884d8" dataKey="valor">
                      {composicaoDespesas.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
    </>
  );
});

export default GraficosFinanceiros;