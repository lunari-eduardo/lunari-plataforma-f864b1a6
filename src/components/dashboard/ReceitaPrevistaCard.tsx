import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign } from 'lucide-react';
import { useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatCurrency } from '@/utils/financialUtils';
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
export function ReceitaPrevistaCard() {
  const {
    workflowItemsAll
  } = useAppContext();
  const {
    getMonthlyMetrics
  } = useWorkflowMetrics();
  const {
    valorPrevisto,
    valorRecebido,
    aReceber,
    percentualRecebido
  } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Tentar obter do cache primeiro (mesma fonte do Workflow e Finanças)
    const cachedMetrics = getMonthlyMetrics(currentYear, currentMonth);
    if (cachedMetrics) {
      // Usar valores do cache - consistência total
      const percentual = cachedMetrics.previsto > 0 ? cachedMetrics.receita / cachedMetrics.previsto * 100 : 0;
      return {
        valorPrevisto: cachedMetrics.previsto,
        valorRecebido: cachedMetrics.receita,
        aReceber: cachedMetrics.aReceber,
        percentualRecebido: percentual
      };
    }

    // Fallback para cálculo manual (primeira execução)
    const itemsDoMes = workflowItemsAll.filter(item => {
      if (!item.data) return false;
      const itemDate = new Date(item.data);
      return itemDate.getMonth() + 1 === currentMonth && itemDate.getFullYear() === currentYear;
    });
    const previsto = itemsDoMes.reduce((acc, item) => acc + (item.total || 0), 0);
    const recebido = itemsDoMes.reduce((acc, item) => acc + (item.valorPago || 0), 0);
    const restante = previsto - recebido;
    const percentual = previsto > 0 ? recebido / previsto * 100 : 0;
    return {
      valorPrevisto: previsto,
      valorRecebido: recebido,
      aReceber: restante,
      percentualRecebido: percentual
    };
  }, [workflowItemsAll, getMonthlyMetrics]);
  return <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-semibold text-base">Receita Prevista do Mês</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Previsto */}
          <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Total Previsto</span>
              <div className="p-2 rounded-lg bg-brand-gradient">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-lunar-text mt-2">
              {formatCurrency(valorPrevisto)}
            </div>
          </div>

          {/* Valor Recebido */}
          <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">Recebido</span>
              <div className="p-2 rounded-lg bg-brand-gradient">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-lunar-success mt-2">
              {formatCurrency(valorRecebido)}
            </div>
            <div className="text-xs text-lunar-textSecondary mt-1">
              {percentualRecebido.toFixed(1)}% do previsto
            </div>
          </div>

          {/* A Receber */}
          <div className="dashboard-card-inner relative rounded-xl border border-lunar-border/30 bg-card-gradient shadow-card-subtle hover:shadow-card-elevated transition-all duration-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-textSecondary font-medium">A Receber</span>
              <div className="p-2 rounded-lg bg-brand-gradient">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-chart-primary mt-2">
              {formatCurrency(aReceber)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
}