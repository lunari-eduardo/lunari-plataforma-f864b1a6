import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/financialUtils';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';
import { useResponsiveFinancas } from '@/hooks/useResponsiveFinancas';
import { Trash2, DollarSign, Calendar, HandCoins, ArrowDown, TrendingUp, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { lazy, Suspense, memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddEquipmentFromTransactionModal } from '@/components/equipments/AddEquipmentFromTransactionModal';

// Lazy loading para gráficos pesados
const GraficosFinanceiros = lazy(() => import('@/components/financas/GraficosFinanceiros'));

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
const DashboardFinanceiro = memo(function DashboardFinanceiro() {
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
    comparisonData,
    categoriasDetalhadas,
    getNomeMes,
    excluirMetaAnual,
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose
  } = useDashboardFinanceiro();
  
  const { classesGrid, classesCarta, isMobile } = useResponsiveFinancas();
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
      <div className="p-6 space-y-6 py-0 my-0">
        {/* Hero Section */}
        <section aria-label="Dashboard Header" className="animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 overflow-hidden">
            <div className="relative">
              {/* decorative accents */}
              <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.12]" />
              
            </div>
          </Card>
        </section>

        {/* Filtros - Barra moderna */}
        <section aria-label="Filtros" className="animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Filtros de período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs text-lunar-textSecondary font-medium block mb-2">
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
                  <label className="text-xs text-lunar-textSecondary font-medium block mb-2">
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
                    <div className="px-3 py-2 bg-brand-gradient/10 rounded-lg text-sm font-medium text-lunar-text border border-lunar-border/30">
                      {getNomeMes(mesSelecionado)} {anoSelecionado}
                    </div>
                  </div>}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* KPIs Cards - Design moderno */}
        <section aria-label="Métricas Financeiras" className="animate-fade-in">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Métricas principais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Receita */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">Receita</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <DollarSign className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-lunar-success mt-2">
                    {formatCurrency(kpisData.totalReceita)}
                  </div>
                  {comparisonData.variacaoReceita !== null && <div className={`text-xs mt-1 flex items-center ${comparisonData.variacaoReceita > 0 ? 'text-lunar-success' : 'text-destructive'}`}>
                      {comparisonData.variacaoReceita > 0 ? '↗' : '↘'} {Math.abs(comparisonData.variacaoReceita).toFixed(1)}% {comparisonData.labelComparacao}
                    </div>}
                </div>

                {/* Previsto */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">Previsto</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-primary mt-2">
                    {formatCurrency(kpisData.valorPrevisto)}
                  </div>
                </div>

                {/* A Receber */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">A Receber</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <HandCoins className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-chart-primary mt-2">
                    {formatCurrency(kpisData.aReceber)}
                  </div>
                </div>

                {/* Despesas */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">Despesas</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <ArrowDown className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-destructive mt-2">
                    -{formatCurrency(kpisData.totalDespesas)}
                  </div>
                </div>

                {/* Lucro */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">Lucro</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-lunar-success mt-2">
                    {formatCurrency(kpisData.totalLucro)}
                  </div>
                  {comparisonData.variacaoLucro !== null && <div className={`text-xs mt-1 flex items-center ${comparisonData.variacaoLucro > 0 ? 'text-lunar-success' : 'text-destructive'}`}>
                      {comparisonData.variacaoLucro > 0 ? '↗' : '↘'} {Math.abs(comparisonData.variacaoLucro).toFixed(1)}% {comparisonData.labelComparacao}
                    </div>}
                </div>

                {/* Saldo */}
                <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-lunar-textSecondary font-medium">Saldo</span>
                    <div className="p-2 rounded-lg bg-brand-gradient">
                      <Landmark className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-chart-primary mt-2">
                    {formatCurrency(kpisData.saldoTotal)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Gráficos Circulares de Metas */}
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
                    <Pie data={[{
                      name: 'Atingido',
                      value: Math.max(0, metasData.receitaAtual)
                    }, {
                      name: 'Restante',
                      value: Math.max(0, metasData.metaReceita - metasData.receitaAtual)
                    }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={450} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      <Cell fill="hsl(var(--chart-revenue))" />
                      <Cell fill="hsl(var(--muted))" opacity={0.3} />
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}>
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
                    <Pie data={[{
                      name: 'Atingido',
                      value: Math.max(0, metasData.lucroAtual)
                    }, {
                      name: 'Restante',
                      value: Math.max(0, metasData.metaLucro - metasData.lucroAtual)
                    }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={450} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      <Cell fill="hsl(var(--chart-secondary))" />
                      <Cell fill="hsl(var(--muted))" opacity={0.3} />
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}>
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
                    <Pie data={[{
                      name: 'Lucratividade',
                      value: Math.max(0, Math.min(100, lucratividade))
                    }, {
                      name: 'Restante',
                      value: Math.max(0, 100 - lucratividade)
                    }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={450} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      <Cell fill="hsl(var(--chart-primary))" />
                      <Cell fill="hsl(var(--muted))" opacity={0.3} />
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fill: 'hsl(var(--foreground))'
                    }}>
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
        </section>

        {/* Gráficos com Lazy Loading */}
        <Suspense fallback={<div className="flex justify-center py-8">Carregando gráficos...</div>}>
          <GraficosFinanceiros 
            dadosMensais={dadosMensais}
            composicaoDespesas={composicaoDespesas}
            evolucaoCategoria={evolucaoCategoria[categoriaSelecionada] || []}
            categoriaSelecionada={categoriaSelecionada}
            roiData={roiData}
            categoriasDetalhadas={categoriasDetalhadas}
            despesasPorCategoria={categoriasDetalhadas.map(item => ({
              categoria: item.categoria,
              mes: anoSelecionado,
              valor: item.valor
            }))}
          />
        </Suspense>
        
        {/* Modal de equipamento */}
        {equipmentData && (
          <AddEquipmentFromTransactionModal
            isOpen={equipmentModalOpen}
            onClose={handleEquipmentModalClose}
            equipmentData={{
              nome: equipmentData.nome,
              valor: equipmentData.valor,
              data: equipmentData.data
            }}
          />
        )}
      </div>
    </div>
});

export default DashboardFinanceiro;