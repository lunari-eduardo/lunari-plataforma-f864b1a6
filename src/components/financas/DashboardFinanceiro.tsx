import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/financialUtils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Paleta de cores beige/marrom elegantes
const COLORS = ['hsl(var(--finance-primary))', 'hsl(var(--finance-secondary))'];
const EXPENSE_COLORS = ['hsl(var(--finance-primary))', 'hsl(var(--chart-secondary))', 'hsl(var(--chart-tertiary))', 'hsl(var(--chart-quaternary))', 'hsl(var(--chart-quinary))', 'hsl(var(--chart-senary))'];
export default function DashboardFinanceiro() {
  const {
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    anosDisponiveis,
    categoriaSelecionada,
    setCategoriaSelecionada,
    categoriasDisponiveis,
    kpisData,
    metasData,
    dadosMensais,
    composicaoDespesas,
    evolucaoCategoria,
    roiData,
    getNomeMes,
    excluirMetaAnual
  } = useDashboardFinanceiro();

  const handleExcluirMeta = () => {
    excluirMetaAnual();
    toast.success(`Meta anual para ${anoSelecionado} foi excluída`);
  };

  // Cálculos para gráficos de metas
  const lucratividade = metasData.receitaAtual > 0 ? metasData.lucroAtual / metasData.receitaAtual * 100 : 0;
  const percentMetaReceita = metasData.metaReceita > 0 ? metasData.receitaAtual / metasData.metaReceita * 100 : 0;
  const percentMetaLucro = metasData.metaLucro > 0 ? metasData.lucroAtual / metasData.metaLucro * 100 : 0;

  // Opções para o seletor de mês
  const opcoesmes = [{
    value: 'ano-completo',
    label: 'Ano Completo'
  }, {
    value: '1',
    label: 'Janeiro'
  }, {
    value: '2',
    label: 'Fevereiro'
  }, {
    value: '3',
    label: 'Março'
  }, {
    value: '4',
    label: 'Abril'
  }, {
    value: '5',
    label: 'Maio'
  }, {
    value: '6',
    label: 'Junho'
  }, {
    value: '7',
    label: 'Julho'
  }, {
    value: '8',
    label: 'Agosto'
  }, {
    value: '9',
    label: 'Setembro'
  }, {
    value: '10',
    label: 'Outubro'
  }, {
    value: '11',
    label: 'Novembro'
  }, {
    value: '12',
    label: 'Dezembro'
  }];
  return <div className="min-h-screen bg-lunar-bg">
      <div className="p-6 space-y-6 bg-lunar-bg">
        {/* Barra de Filtros de Período - Design elegante */}
        <Card className="border-0 shadow-lg bg-card rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-primary">Filtros de Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Ano
                </label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map(ano => <SelectItem key={ano} value={ano.toString()}>
                        {ano}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Período
                </label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesmes.map(opcao => <SelectItem key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {mesSelecionado && mesSelecionado !== 'ano-completo' && <div className="flex items-end">
                  <div className="px-3 py-2 bg-primary/10 rounded-lg text-sm font-medium">
                    Período: {getNomeMes(mesSelecionado)} {anoSelecionado}
                  </div>
                </div>}
            </div>
          </CardContent>
        </Card>

        {/* KPIs Cards - Design elegante */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">RECEITA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-lunar-success">
                {formatCurrency(kpisData.totalReceita)}
              </div>
              <div className="text-xs mt-1 text-muted-foreground">↗ 12% em comparação ao mês anterior</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">PREVISTO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(kpisData.valorPrevisto)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">A RECEBER</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-chart-primary">
                {formatCurrency(kpisData.aReceber)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">DESPESAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-destructive">
                -{formatCurrency(kpisData.totalDespesas)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">LUCRO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-lunar-success">
                {formatCurrency(kpisData.totalLucro)}
              </div>
              <div className="text-xs mt-1 text-muted-foreground">↗ 18% em comparação ao mês anterior</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 bg-card rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-foreground">SALDO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-chart-primary">
                {formatCurrency(kpisData.saldoTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Circulares de Metas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meta de Receita */}
          <Card className="border-0 shadow-lg bg-card rounded-lg">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">META DE RECEITA</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Atingido', value: Math.max(0, metasData.receitaAtual) },
                        { name: 'Restante', value: Math.max(0, metasData.metaReceita - metasData.receitaAtual) }
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
                      {metasData.metaReceita > 0 ? 
                        `${(metasData.receitaAtual / metasData.metaReceita * 100).toFixed(1)}%` : 
                        '0%'
                      }
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
          <Card className="border-0 shadow-lg bg-card rounded-lg">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">META DE LUCRO</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Atingido', value: Math.max(0, metasData.lucroAtual) },
                        { name: 'Restante', value: Math.max(0, metasData.metaLucro - metasData.lucroAtual) }
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
                      {metasData.metaLucro > 0 ? 
                        `${(metasData.lucroAtual / metasData.metaLucro * 100).toFixed(1)}%` : 
                        '0%'
                      }
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
          <Card className="border-0 shadow-lg bg-card rounded-lg">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wide text-foreground">LUCRATIVIDADE</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Lucratividade', value: Math.max(0, Math.min(100, lucratividade)) },
                        { name: 'Restante', value: Math.max(0, 100 - lucratividade) }
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
                  Margem de Lucro Atual
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico Principal - Receita vs Lucro */}
        <Card className="border-0 shadow-lg bg-card rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <div className="w-3 h-3 rounded-full bg-chart-primary"></div>
              RECEITA
              <div className="w-3 h-3 rounded-full ml-4 bg-muted"></div>
              LUCRO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dadosMensais} margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20
            }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="mes" tick={{
                fontSize: 12,
                fill: 'hsl(var(--foreground))',
                fontWeight: 500
              }} tickLine={{
                stroke: 'hsl(var(--border))'
              }} axisLine={{
                stroke: 'hsl(var(--border))'
              }} />
                <YAxis 
                  domain={[0, 'dataMax']}
                  tick={{
                    fontSize: 12,
                    fill: 'hsl(var(--foreground))',
                    fontWeight: 500
                  }} 
                  tickLine={{
                    stroke: 'hsl(var(--border))'
                  }} 
                  axisLine={{
                    stroke: 'hsl(var(--border))'
                  }}
                  tickFormatter={value => `R$ ${Number(value).toLocaleString('pt-BR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}`} 
                />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => {
                    // Force correct labels based on dataKey
                    const label = props.dataKey === 'lucro' ? 'Lucro' : 
                                 props.dataKey === 'receita' ? 'Receita' : name;
                    return [formatCurrency(value), label];
                  }}
                  labelStyle={{
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                    fontWeight: 500
                  }} 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                  cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
                />
                <Legend wrapperStyle={{
                  fontSize: '12px',
                  color: 'hsl(var(--muted-foreground))',
                  fontWeight: 500
                }} />
                <Bar 
                  dataKey="receita" 
                  fill="hsl(var(--chart-primary))" 
                  name="Receita" 
                  radius={[6, 6, 0, 0]} 
                  opacity={0.9}
                />
                <Bar 
                  dataKey="lucro" 
                  fill="hsl(var(--muted))" 
                  name="Lucro" 
                  radius={[6, 6, 0, 0]} 
                  opacity={0.9}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fluxo de Caixa - Gráfico de Área */}
        <Card className="border-0 shadow-lg bg-card rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">FLUXO DE CAIXA</CardTitle>
            <p className="text-sm text-muted-foreground">Análise mensal do ano selecionado</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dadosMensais} margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20
            }}>
                <defs>
                  <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="mes" tick={{
                fontSize: 11,
                fill: 'hsl(var(--foreground))',
                fontWeight: 500
              }} tickLine={{
                stroke: 'hsl(var(--border))'
              }} axisLine={{
                stroke: 'hsl(var(--border))'
              }} />
                <YAxis tick={{
                fontSize: 11,
                fill: 'hsl(var(--foreground))',
                fontWeight: 500
              }} tickLine={{
                stroke: 'hsl(var(--border))'
              }} axisLine={{
                stroke: 'hsl(var(--border))'
              }} tickFormatter={value => `${Number(value).toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                fontWeight: 500
              }} contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }} />
                <Area type="monotone" dataKey="receita" stroke="hsl(var(--chart-primary))" fillOpacity={1} fill="url(#colorArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card className="border-0 shadow-lg bg-card rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-center text-foreground">DESPESAS POR CATEGORIA</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie data={composicaoDespesas} cx="50%" cy="50%" innerRadius={80} outerRadius={150} dataKey="valor" strokeWidth={3} stroke="hsl(var(--card))">
                  {composicaoDespesas.map((entry, index) => <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} opacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string, props: any) => [formatCurrency(value), `${props.payload.grupo} (${props.payload.percentual.toFixed(1)}%)`]} labelStyle={{
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                fontWeight: 500
              }} contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{
                fontSize: '12px',
                fontWeight: 500
              }} formatter={(value, entry) => <span style={{
                color: entry.color
              }}>
                      {value} ({composicaoDespesas.find(item => item.grupo === value)?.percentual.toFixed(1)}%)
                    </span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Section - Cálculo correto: Lucro / Investimentos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-card rounded-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-sm font-medium text-foreground">ROI</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-sm text-muted-foreground">VALOR INVESTIDO</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(roiData.totalInvestimento)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-card rounded-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-sm font-medium text-foreground">RETORNO SOBRE INVESTIMENTO</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-chart-primary">
                {roiData.roi.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>;
}