/**
 * Cards de resumo do extrato
 * Standardized visual language matching Dashboard cards
 */

import { Card, CardContent } from '@/components/ui/card';
import { ResumoExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/currencyUtils';
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtratoSummaryCardsProps {
  resumo: ResumoExtrato;
}

interface SummaryCardProps {
  title: string;
  value: number;
  subtitle?: string;
  subtitleValue?: number;
  icon: React.ElementType;
  iconBgClass: string;
  valueColorClass?: string;
  isNegative?: boolean;
}

function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  subtitleValue, 
  icon: Icon, 
  iconBgClass,
  valueColorClass,
  isNegative = false,
}: SummaryCardProps) {
  const displayValue = isNegative && value !== 0 ? -Math.abs(value) : value;
  const colorClass = valueColorClass || (value >= 0 ? 'text-foreground' : 'text-destructive');
  
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate mb-1">
              {title}
            </p>
            <p className={cn("text-lg font-bold tabular-nums", colorClass)}>
              {formatCurrency(displayValue)}
            </p>
            {subtitle && subtitleValue !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}: <span className="font-medium">{formatCurrency(subtitleValue)}</span>
              </p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg shrink-0", iconBgClass)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExtratoSummaryCards({ resumo }: ExtratoSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* ENTRADAS (PAGAS) */}
      <SummaryCard
        title="Entradas (pagas)"
        value={resumo.entradasPagas}
        subtitle="Agendadas"
        subtitleValue={resumo.entradasAgendadas}
        icon={TrendingUp}
        iconBgClass="bg-emerald-500"
        valueColorClass="text-emerald-600 dark:text-emerald-400"
      />

      {/* SAÍDAS EFETIVAS (PAGAS) */}
      <SummaryCard
        title="Saídas (pagas)"
        value={resumo.saidasPagas}
        subtitle="Futuras"
        subtitleValue={resumo.saidasAgendadas}
        icon={TrendingDown}
        iconBgClass="bg-red-500"
        valueColorClass="text-red-600 dark:text-red-400"
        isNegative
      />

      {/* SALDO REAL */}
      <SummaryCard
        title="Saldo Real"
        value={resumo.saldoEfetivo}
        subtitle="Apenas valores pagos"
        icon={DollarSign}
        iconBgClass="bg-blue-500"
        valueColorClass={resumo.saldoEfetivo >= 0 
          ? "text-emerald-600 dark:text-emerald-400" 
          : "text-red-600 dark:text-red-400"
        }
      />

      {/* SAÍDAS FUTURAS */}
      <SummaryCard
        title="Saídas Futuras"
        value={resumo.saidasAgendadas}
        subtitle="Valores agendados"
        icon={Clock}
        iconBgClass="bg-amber-500"
        valueColorClass="text-amber-600 dark:text-amber-400"
        isNegative
      />

      {/* SALDO PROJETADO */}
      <SummaryCard
        title="Saldo Projetado"
        value={resumo.saldoProjetado}
        subtitle="Incluindo futuros"
        icon={AlertCircle}
        iconBgClass="bg-purple-500"
        valueColorClass={resumo.saldoProjetado >= 0 
          ? "text-emerald-600 dark:text-emerald-400" 
          : "text-red-600 dark:text-red-400"
        }
      />

      {/* TOTAL A RECEBER */}
      <SummaryCard
        title="A Receber"
        value={resumo.totalAReceber}
        subtitle="Entradas agendadas"
        icon={CheckCircle}
        iconBgClass="bg-yellow-500"
        valueColorClass="text-yellow-600 dark:text-yellow-400"
      />
    </div>
  );
}
