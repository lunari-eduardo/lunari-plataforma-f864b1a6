import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/financialUtils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Mock data
const kpisData = {
  totalReceita: 1779840,
  totalDespesas: 529307.5,
  totalLucro: 366252.5,
  saldoTotal: 946252.5
};

const metasData = {
  metaReceita: 2000000,
  metaLucro: 500000,
  receitaAtual: 1779840,
  lucroAtual: 366252.5
};

const receitaLucroMensal = [
  { mes: 'JAN', receita: 63482.25, lucro: 10000 },
  { mes: 'FEV', receita: 66740.50, lucro: -5000 },
  { mes: 'MAR', receita: 54709.46, lucro: 15000 },
  { mes: 'ABR', receita: 76481.55, lucro: 21772.02 },
  { mes: 'MAI', receita: 91008.04, lucro: 14926.57 },
  { mes: 'JUN', receita: 94625.25, lucro: 3617.12 },
  { mes: 'JUL', receita: 94625.25, lucro: 0 },
  { mes: 'AGO', receita: 94625.25, lucro: 0 },
  { mes: 'SET', receita: 94625.25, lucro: 0 },
  { mes: 'OUT', receita: 94625.25, lucro: 0 },
  { mes: 'NOV', receita: 94625.25, lucro: 0 },
  { mes: 'DEZ', receita: 94625.25, lucro: 0 }
];

const custosFixos = [
  { categoria: 'Funcionários', valor: 102500 },
  { categoria: 'Aluguel', valor: 91548 },
  { categoria: 'Luz', valor: 6890 },
  { categoria: 'Internet', valor: 6360 },
  { categoria: 'MEI', valor: 660 },
  { categoria: 'Água', valor: 3647 },
  { categoria: 'Adobe', valor: 2820 },
  { categoria: 'Canva', valor: 1440 },
  { categoria: '15º', valor: 0 },
  { categoria: 'Limpeza', valor: 0 },
  { categoria: 'Pró-Labore', valor: 0 }
];

const custosVariaveis = [
  { categoria: 'SCHLOSSER', valor: 91030 },
  { categoria: 'Embalagens', valor: 8003 },
  { categoria: 'Outras despesas', valor: 6344 },
  { categoria: 'SYSTEM', valor: 2784 },
  { categoria: 'BÔNUS', valor: 0 },
  { categoria: 'Combustível', valor: 0 },
  { categoria: 'Impostos', valor: 0 }
];

const investimentos = [
  { categoria: 'Cursos e Treinamentos', valor: 0 },
  { categoria: 'Equipamentos', valor: 19880 },
  { categoria: 'Acervo/Cenário', valor: 7805 },
  { categoria: 'Marketing', valor: 4800 }
];

const categoriasDisponiveis = [
  'Funcionários', 'Aluguel', 'SCHLOSSER', 'Equipamentos', 'Marketing', 'Luz', 'Internet'
];

const evolucaoCategoria = {
  'Funcionários': [
    { mes: 'JAN', valor: 159.50 },
    { mes: 'FEV', valor: 143.88 },
    { mes: 'MAR', valor: 131.75 },
    { mes: 'ABR', valor: 131.75 },
    { mes: 'MAI', valor: 67.91 },
    { mes: 'JUN', valor: 0 },
    { mes: 'JUL', valor: 0 },
    { mes: 'AGO', valor: 0 },
    { mes: 'SET', valor: 0 },
    { mes: 'OUT', valor: 0 },
    { mes: 'NOV', valor: 0 },
    { mes: 'DEZ', valor: 0 }
  ],
  'Luz': [
    { mes: 'JAN', valor: 150 },
    { mes: 'FEV', valor: 140 },
    { mes: 'MAR', valor: 160 },
    { mes: 'ABR', valor: 155 },
    { mes: 'MAI', valor: 145 },
    { mes: 'JUN', valor: 170 },
    { mes: 'JUL', valor: 165 },
    { mes: 'AGO', valor: 175 },
    { mes: 'SET', valor: 160 },
    { mes: 'OUT', valor: 150 },
    { mes: 'NOV', valor: 155 },
    { mes: 'DEZ', valor: 180 }
  ]
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

export default function DashboardFinanceiro() {
  const [anoSelecionado, setAnoSelecionado] = useState('2024');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Funcionários');

  const lucratividade = (metasData.lucroAtual / metasData.receitaAtual) * 100;
  const percentMetaReceita = (metasData.receitaAtual / metasData.metaReceita) * 100;
  const percentMetaLucro = (metasData.lucroAtual / metasData.metaLucro) * 100;

  const dadosGraficoReceita = [
    { name: 'Atingido', value: metasData.receitaAtual },
    { name: 'Restante', value: metasData.metaReceita - metasData.receitaAtual }
  ];

  const dadosGraficoLucro = [
    { name: 'Atingido', value: metasData.lucroAtual },
    { name: 'Restante', value: metasData.metaLucro - metasData.lucroAtual }
  ];

  const dadosGraficoLucratividade = [
    { name: 'Lucratividade', value: lucratividade },
    { name: 'Restante', value: 100 - lucratividade }
  ];

  return (
    <div className="space-y-6">
      {/* Filtro de Ano */}
      <div className="flex justify-end">
        <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Widget 1: KPIs de Alto Nível */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL RECEITA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpisData.totalReceita)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL DESPESAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">-{formatCurrency(kpisData.totalDespesas)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL LUCRO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpisData.totalLucro)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SALDO TOTAL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpisData.saldoTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Widget 2: Acompanhamento de Metas Anuais */}
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
                >
                  {dadosGraficoReceita.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
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
                >
                  {dadosGraficoLucro.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
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
                >
                  {dadosGraficoLucratividade.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                  <tspan x="50%" className="text-2xl font-bold">{lucratividade.toFixed(1)}%</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Widget 3: Análise Mensal - Receita vs. Lucro */}
      <Card>
        <CardHeader>
          <CardTitle>FLUXO DE CAIXA</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={receitaLucroMensal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" name="Lucro" />
              <Bar dataKey="receita" fill="hsl(var(--muted))" name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Widget 4: Detalhamento Anual de Custos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CUSTO FIXO ANUAL</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="horizontal" data={custosFixos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="categoria" type="category" width={80} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CUSTO VARIÁVEL ANUAL</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="horizontal" data={custosVariaveis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="categoria" type="category" width={80} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>INVESTIMENTOS ANUAL</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="horizontal" data={investimentos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="categoria" type="category" width={80} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Widget 5: Análise de Categoria Específica */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>EVOLUÇÃO DE CUSTO POR CATEGORIA</CardTitle>
            <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Gastos por Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDisponiveis.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={evolucaoCategoria[categoriaSelecionada] || evolucaoCategoria['Funcionários']}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="valor" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}