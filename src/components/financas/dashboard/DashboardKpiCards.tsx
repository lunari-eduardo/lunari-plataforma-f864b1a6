import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Calendar, HandCoins, ArrowDown, TrendingUp, Landmark } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import type { KpiCardsProps } from './types';

export function DashboardKpiCards({ kpisData, comparisonData }: KpiCardsProps) {
  return (
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
              {comparisonData.variacaoReceita !== null && (
                <div className={`text-xs mt-1 flex items-center ${comparisonData.variacaoReceita > 0 ? 'text-lunar-success' : 'text-destructive'}`}>
                  {comparisonData.variacaoReceita > 0 ? '↗' : '↘'} {Math.abs(comparisonData.variacaoReceita).toFixed(1)}% {comparisonData.labelComparacao}
                </div>
              )}
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
              {comparisonData.variacaoLucro !== null && (
                <div className={`text-xs mt-1 flex items-center ${comparisonData.variacaoLucro > 0 ? 'text-lunar-success' : 'text-destructive'}`}>
                  {comparisonData.variacaoLucro > 0 ? '↗' : '↘'} {Math.abs(comparisonData.variacaoLucro).toFixed(1)}% {comparisonData.labelComparacao}
                </div>
              )}
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
  );
}