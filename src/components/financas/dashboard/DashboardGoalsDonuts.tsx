import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/utils/financialUtils';
import type { GoalsDonutsProps } from './types';

export function DashboardGoalsDonuts({ metasData }: GoalsDonutsProps) {
  // Cálculo da lucratividade
  const lucratividade = metasData.receitaAtual > 0 ? metasData.lucroAtual / metasData.receitaAtual * 100 : 0;

  return (
    <section aria-label="Metas" className="animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meta de Receita */}
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">META DE RECEITA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie 
                    data={[
                      {
                        name: 'Atingido',
                        value: Math.max(0, metasData.receitaAtual)
                      }, 
                      {
                        name: 'Restante',
                        value: Math.max(0, metasData.metaReceita - metasData.receitaAtual)
                      }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    startAngle={90} 
                    endAngle={450} 
                    dataKey="value" 
                    strokeWidth={2} 
                    stroke="hsl(var(--card))"
                  >
                    <Cell fill="hsl(var(--chart-revenue))" />
                    <Cell fill="hsl(var(--muted))" opacity={0.3} />
                  </Pie>
                  <text 
                    x="50%" 
                    y="50%" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}
                  >
                    {metasData.metaReceita > 0 ? `${(metasData.receitaAtual / metasData.metaReceita * 100).toFixed(1)}%` : '0%'}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-2">
              <div className="text-sm text-muted-foreground">
                {formatCurrency(metasData.receitaAtual)} / {formatCurrency(metasData.metaReceita)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta de Lucro */}
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">META DE LUCRO</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie 
                    data={[
                      {
                        name: 'Atingido',
                        value: Math.max(0, metasData.lucroAtual)
                      }, 
                      {
                        name: 'Restante',
                        value: Math.max(0, metasData.metaLucro - metasData.lucroAtual)
                      }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    startAngle={90} 
                    endAngle={450} 
                    dataKey="value" 
                    strokeWidth={2} 
                    stroke="hsl(var(--card))"
                  >
                    <Cell fill="hsl(var(--chart-secondary))" />
                    <Cell fill="hsl(var(--muted))" opacity={0.3} />
                  </Pie>
                  <text 
                    x="50%" 
                    y="50%" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}
                  >
                    {metasData.metaLucro > 0 ? `${(metasData.lucroAtual / metasData.metaLucro * 100).toFixed(1)}%` : '0%'}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-2">
              <div className="text-sm text-muted-foreground">
                {formatCurrency(metasData.lucroAtual)} / {formatCurrency(metasData.metaLucro)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lucratividade */}
        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">LUCRATIVIDADE</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie 
                    data={[
                      {
                        name: 'Lucratividade',
                        value: Math.max(0, Math.min(100, lucratividade))
                      }, 
                      {
                        name: 'Restante',
                        value: Math.max(0, 100 - lucratividade)
                      }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    startAngle={90} 
                    endAngle={450} 
                    dataKey="value" 
                    strokeWidth={2} 
                    stroke="hsl(var(--card))"
                  >
                    <Cell fill="hsl(var(--chart-primary))" />
                    <Cell fill="hsl(var(--muted))" opacity={0.3} />
                  </Pie>
                  <text 
                    x="50%" 
                    y="50%" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}
                  >
                    {lucratividade.toFixed(1)}%
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-2">
              <div className="text-sm text-muted-foreground">
                Margem de lucratividade
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}