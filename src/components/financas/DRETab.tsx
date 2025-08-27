import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowUpRight, ArrowDownRight, Minus, FileText, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { DreEngine } from '@/services/DreEngine';
import { DREMode, DREPeriod, DREConfig, DREResult, DRE_CONFIG_FOTOGRAFOS } from '@/types/dre';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useAppContext } from '@/contexts/AppContext';
import { formatCurrency } from '@/utils/financialUtils';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

export default function DRETab() {
  const { itensFinanceiros } = useNovoFinancas();
  const { workflowItems } = useAppContext();

  // Estados do componente
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<DREMode>('competencia');
  const [showPercentages, setShowPercentages] = useState(true);
  const [showComparative, setShowComparative] = useState(false);

  // Configuração DRE (carregada do localStorage ou padrão)
  const dreConfig = useMemo((): DREConfig => {
    const savedConfig = localStorage.getItem('dre_config_v1');
    if (savedConfig) {
      try {
        return { ...DRE_CONFIG_FOTOGRAFOS, ...JSON.parse(savedConfig) } as DREConfig;
      } catch (error) {
        console.error('Erro ao carregar configuração DRE:', error);
      }
    }
    return DRE_CONFIG_FOTOGRAFOS as DREConfig;
  }, []);

  // Dados reais das transações financeiras
  const novoFinancasData = useNovoFinancas();
  
  const transacoesFinanceiras = useMemo(() => {
    // Usar transacoes do useNovoFinancas que é compatível
    console.log('🔍 DRE: Transações disponíveis:', novoFinancasData.transacoes.length);
    return novoFinancasData.transacoes;
  }, [novoFinancasData.transacoes]);

  // Período atual
  const currentPeriod: DREPeriod = {
    type: periodType,
    ...(periodType === 'monthly' ? { month: selectedMonth } : {}),
    year: selectedYear
  };

  // Calcular DRE com dados reais
  const dreResult = useMemo(() => {
    console.log('🧮 DRE: Calculando com dados reais...', {
      period: currentPeriod,
      mode,
      transacoesCount: transacoesFinanceiras.length,
      workflowCount: workflowItems.length
    });

    const deps = { transacoesFinanceiras, workflowItems };
    const baseResult = DreEngine.computeDRE(currentPeriod, mode, dreConfig, deps);
    
    console.log('📊 DRE: Resultado calculado:', baseResult.kpis);
    
    return showComparative 
      ? DreEngine.computeComparative(baseResult, dreConfig, deps)
      : baseResult;
  }, [currentPeriod, mode, dreConfig, transacoesFinanceiras, workflowItems, showComparative]);

  // Navegação para extrato com filtros
  const openExtratoWithFilters = (groupKey: string, value: number) => {
    if (value === 0) return;
    
    // Construir query string para filtros
    const params = new URLSearchParams();
    params.set('tab', 'extrato');
    params.set('dreGroup', groupKey);
    params.set('period', `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`);
    params.set('mode', mode);
    
    // Navegar para página com filtros
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    
    // Disparar evento para componente pai atualizar a aba
    window.dispatchEvent(new CustomEvent('dre-drill-down', { 
      detail: { 
        tab: 'extrato', 
        filters: { 
          dreGroup: groupKey, 
          period: `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`,
          mode 
        } 
      } 
    }));
  };

  const renderKPICard = (title: string, value: number, previousValue?: number, icon?: React.ReactNode) => {
    const delta = previousValue !== undefined ? value - previousValue : undefined;
    const deltaPercentual = previousValue !== undefined && previousValue !== 0 
      ? ((value - previousValue) / previousValue) * 100 
      : undefined;

    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(value)}
          </div>
          {showComparative && delta !== undefined && deltaPercentual !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {deltaPercentual > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : deltaPercentual < 0 ? (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`text-sm font-medium ${
                deltaPercentual > 0 ? 'text-green-600' : 
                deltaPercentual < 0 ? 'text-red-600' : 
                'text-muted-foreground'
              }`}>
                {deltaPercentual > 0 ? '+' : ''}{deltaPercentual.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                ({formatCurrency(Math.abs(delta))})
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDRELine = (line: any, level = 0) => {
    const isNegative = line.label.includes('(-)');
    const isPositive = line.label.includes('(+)') || ['Receita', 'Lucro', 'EBITDA', 'Resultado'].some(term => line.label.includes(term));
    
    return (
      <div key={line.key} className={`${level > 0 ? 'ml-6' : ''}`}>
        <div 
          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
            level === 0 ? 'bg-muted/20 border border-border/30' : 'border-l-2 border-border/30'
          }`}
          onClick={() => openExtratoWithFilters(line.key, line.value)}
        >
          <div className="flex items-center gap-3">
            <span className={`font-medium ${
              isPositive ? 'text-green-700 dark:text-green-400' : 
              isNegative ? 'text-red-700 dark:text-red-400' : 
              'text-foreground'
            }`}>
              {line.label}
            </span>
            {line.value !== 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Ver no Extrato
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {showPercentages && line.percentageOfNet !== undefined && (
              <Badge variant="outline" className="text-xs">
                {line.percentageOfNet.toFixed(1)}%
              </Badge>
            )}
            <span className={`font-semibold text-right min-w-[120px] ${
              isPositive ? 'text-green-700 dark:text-green-400' : 
              isNegative ? 'text-red-700 dark:text-red-400' : 
              'text-foreground'
            }`}>
              {formatCurrency(line.value)}
            </span>
          </div>
        </div>
        
        {line.children && line.children.map((child: any) => (
          <div key={child.key} className="ml-4 mt-1">
            {renderDRELine(child, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Demonstrativo de Resultado (DRE)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Período */}
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodType} onValueChange={(value: 'monthly' | 'annual') => setPeriodType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mês (se mensal) */}
            {periodType === 'monthly' && (
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ano */}
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modo */}
            <div className="space-y-2">
              <Label>Regime</Label>
              <Select value={mode} onValueChange={(value: DREMode) => setMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competencia">Competência</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Switches */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="percentages" 
                checked={showPercentages} 
                onCheckedChange={setShowPercentages} 
              />
              <Label htmlFor="percentages">Mostrar %</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="comparative" 
                checked={showComparative} 
                onCheckedChange={setShowComparative} 
              />
              <Label htmlFor="comparative">Comparar período anterior</Label>
            </div>
            
            <Button variant="outline" size="sm" className="ml-auto">
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {renderKPICard(
          'Receita Líquida',
          dreResult.kpis.receitaLiquida,
          dreResult.previousPeriod?.kpis.receitaLiquida,
          <TrendingUp className="h-4 w-4" />
        )}
        {renderKPICard(
          'Lucro Bruto',
          dreResult.kpis.lucroBruto,
          dreResult.previousPeriod?.kpis.lucroBruto,
          <Activity className="h-4 w-4" />
        )}
        {renderKPICard(
          'EBITDA',
          dreResult.kpis.ebitda,
          dreResult.previousPeriod?.kpis.ebitda,
          <TrendingUp className="h-4 w-4" />
        )}
        {renderKPICard(
          'Lucro Líquido',
          dreResult.kpis.lucroLiquido,
          dreResult.previousPeriod?.kpis.lucroLiquido,
          <TrendingDown className="h-4 w-4" />
        )}
      </div>

      {/* DRE Detalhado */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg">
            Demonstrativo Detalhado - {periodType === 'monthly' 
              ? `${MONTHS[selectedMonth - 1].label}/${selectedYear}`
              : selectedYear
            } ({mode === 'competencia' ? 'Competência' : 'Caixa'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dreResult.lines.map(line => renderDRELine(line))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}