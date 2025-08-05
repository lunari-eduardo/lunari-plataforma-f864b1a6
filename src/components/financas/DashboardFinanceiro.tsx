import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/financialUtils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';

// Paleta de cores elegantes para gráficos
const COLORS = ['hsl(var(--chart-primary))', 'hsl(var(--chart-neutral))'];
const EXPENSE_COLORS = [
  'hsl(var(--chart-primary))', 
  'hsl(var(--chart-secondary))', 
  'hsl(var(--chart-tertiary))', 
  'hsl(var(--chart-quaternary))', 
  'hsl(var(--chart-quinary))', 
  'hsl(var(--chart-senary))'
];
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
    getNomeMes
  } = useDashboardFinanceiro();

  // Cálculos para gráficos de metas
  const lucratividade = metasData.receitaAtual > 0 ? metasData.lucroAtual / metasData.receitaAtual * 100 : 0;
  const percentMetaReceita = metasData.metaReceita > 0 ? metasData.receitaAtual / metasData.metaReceita * 100 : 0;
  const percentMetaLucro = metasData.metaLucro > 0 ? metasData.lucroAtual / metasData.metaLucro * 100 : 0;
  const dadosGraficoReceita = [{
    name: 'Atingido',
    value: Math.max(0, metasData.receitaAtual)
  }, {
    name: 'Restante',
    value: Math.max(0, metasData.metaReceita - metasData.receitaAtual)
  }];
  const dadosGraficoLucro = [{
    name: 'Atingido',
    value: Math.max(0, metasData.lucroAtual)
  }, {
    name: 'Restante',
    value: Math.max(0, metasData.metaLucro - metasData.lucroAtual)
  }];
  const dadosGraficoLucratividade = [{
    name: 'Lucratividade',
    value: Math.max(0, Math.min(100, lucratividade))
  }, {
    name: 'Restante',
    value: Math.max(0, 100 - lucratividade)
  }];

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
  return <div className="space-y-6">
      {/* Nova Barra de Filtros de Período */}
      <Card className="bg-neutral-50 rounded-lg">
        <CardHeader className="pb-1 bg-neutral-50 rounded-lg">
          <CardTitle className="text-base">Filtros de Período</CardTitle>
        </CardHeader>
        <CardContent className="bg-neutral-50 rounded-lg">
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

      {/* Widget 1: KPIs de Alto Nível */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL RECEITA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(kpisData.totalReceita)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL DESPESAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">-{formatCurrency(kpisData.totalDespesas)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL LUCRO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{formatCurrency(kpisData.totalLucro)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SALDO TOTAL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(kpisData.saldoTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Widget 2: Acompanhamento de Metas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">META DE RECEITA</CardTitle>
            <p className="text-center text-sm text-muted-foreground">{formatCurrency(metasData.metaReceita)}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie 
                  data={dadosGraficoReceita} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  startAngle={90} 
                  endAngle={450} 
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#FAF8F5"
                >
                  <Cell fill="hsl(var(--chart-revenue))" />
                  <Cell fill="hsl(var(--chart-neutral))" opacity={0.3} />
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                  <tspan x="50%" dy="-0.5em" className="text-lg font-bold">{formatCurrency(metasData.receitaAtual)}</tspan>
                  <tspan x="50%" dy="1.2em" className="text-sm text-muted-foreground">{percentMetaReceita.toFixed(1)}%</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">META DE LUCRO</CardTitle>
            <p className="text-center text-sm text-muted-foreground">{formatCurrency(metasData.metaLucro)}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie 
                  data={dadosGraficoLucro} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  startAngle={90} 
                  endAngle={450} 
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#FAF8F5"
                >
                  <Cell fill="hsl(var(--chart-profit))" />
                  <Cell fill="hsl(var(--chart-neutral))" opacity={0.3} />
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                  <tspan x="50%" dy="-0.5em" className="text-lg font-bold">{formatCurrency(metasData.lucroAtual)}</tspan>
                  <tspan x="50%" dy="1.2em" className="text-sm text-muted-foreground">{percentMetaLucro.toFixed(1)}%</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">LUCRATIVIDADE</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie 
                  data={dadosGraficoLucratividade} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  startAngle={90} 
                  endAngle={450} 
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#FAF8F5"
                >
                  <Cell fill="hsl(var(--chart-primary))" />
                  <Cell fill="hsl(var(--chart-neutral))" opacity={0.3} />
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                  <tspan x="50%" className="text-2xl font-bold">{lucratividade.toFixed(1)}%</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Widget 3: Fluxo de Caixa (Não Interativo) */}
      <Card>
        <CardHeader>
          <CardTitle>FLUXO DE CAIXA</CardTitle>
          <p className="text-sm text-muted-foreground">Análise mensal do ano selecionado</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosMensais}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DFDA" opacity={0.6} />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 11, fill: '#7C7C7C', fontWeight: 500 }}
                tickLine={{ stroke: '#E1DFDA' }}
                axisLine={{ stroke: '#E1DFDA' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#7C7C7C', fontWeight: 500 }}
                tickLine={{ stroke: '#E1DFDA' }}
                axisLine={{ stroke: '#E1DFDA' }}
                tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value), 
                  name === 'lucro' ? 'Lucro' : 'Receita'
                ]} 
                labelStyle={{ color: '#3A3A3A', fontSize: '12px', fontWeight: 500 }}
                contentStyle={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #E1DFDA',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#7C7C7C', fontWeight: 500 }} />
              <Bar 
                dataKey="receita" 
                fill="hsl(var(--chart-revenue))" 
                name="Receita"
                radius={[4, 4, 0, 0]}
                opacity={0.9}
              />
              <Bar 
                dataKey="lucro" 
                fill="hsl(var(--chart-profit))" 
                name="Lucro"
                radius={[4, 4, 0, 0]}
                opacity={0.9}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Widget 4: Composição das Despesas */}
      <Card>
        <CardHeader>
          <CardTitle>COMPOSIÇÃO DAS DESPESAS</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mesSelecionado && mesSelecionado !== 'ano-completo' ? `Período: ${getNomeMes(mesSelecionado)} ${anoSelecionado}` : `Período: ${anoSelecionado}`}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie 
                data={composicaoDespesas} 
                cx="50%" 
                cy="50%" 
                innerRadius={80} 
                outerRadius={150} 
                dataKey="valor"
                strokeWidth={2}
                stroke="#FAF8F5"
              >
                {composicaoDespesas.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} 
                    opacity={0.9}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  formatCurrency(value), 
                  `${props.payload.grupo} (${props.payload.percentual.toFixed(1)}%)`
                ]} 
                labelStyle={{ color: '#3A3A3A', fontSize: '12px', fontWeight: 500 }}
                contentStyle={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #E1DFDA',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }} 
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>
                    {value} ({composicaoDespesas.find(item => item.grupo === value)?.percentual.toFixed(1)}%)
                  </span>
                )} 
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Widget 5: Evolução de Categoria */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>EVOLUÇÃO DE CUSTO POR CATEGORIA</CardTitle>
            <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Gastos por Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDisponiveis.map(categoria => <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={evolucaoCategoria[categoriaSelecionada] || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DFDA" opacity={0.6} />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 11, fill: '#7C7C7C', fontWeight: 500 }}
                tickLine={{ stroke: '#E1DFDA' }}
                axisLine={{ stroke: '#E1DFDA' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#7C7C7C', fontWeight: 500 }}
                tickLine={{ stroke: '#E1DFDA' }}
                axisLine={{ stroke: '#E1DFDA' }}
                tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)} 
                labelStyle={{ color: '#3A3A3A', fontSize: '12px', fontWeight: 500 }}
                contentStyle={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #E1DFDA',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="valor" 
                stroke="hsl(var(--chart-secondary))" 
                fill="hsl(var(--chart-secondary))" 
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>;
}