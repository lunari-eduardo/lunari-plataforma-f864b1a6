/**
 * Cards de resumo do extrato
 * Standardized visual language matching Dashboard cards
 * Subtítulos e tooltips contextualizados por regime contábil
 */

import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResumoExtrato } from '@/types/extrato';
import { RegimeContabil } from '@/hooks/useExtratoSupabase';
import { formatCurrency } from '@/utils/currencyUtils';
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtratoSummaryCardsProps {
  resumo: ResumoExtrato;
  regime?: RegimeContabil;
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
  tooltip?: string;
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
  tooltip,
}: SummaryCardProps) {
  const displayValue = isNegative && value !== 0 ? -Math.abs(value) : value;
  const colorClass = valueColorClass || (value >= 0 ? 'text-foreground' : 'text-destructive');
  
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {title}
              </p>
              {tooltip && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={cn("text-lg font-bold tabular-nums", colorClass)}>
              {formatCurrency(displayValue)}
            </p>
            {subtitle && subtitleValue !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}: <span className="font-medium">{formatCurrency(subtitleValue)}</span>
              </p>
            )}
            {subtitle && subtitleValue === undefined && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg shrink-0", iconBgClass)}>
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExtratoSummaryCards({ resumo, regime = 'caixa' }: ExtratoSummaryCardsProps) {
  const isCompetencia = regime === 'competencia';

  // Subtítulos contextuais por regime
  const aReceberSubtitle = isCompetencia 
    ? 'Saldo sessões + agendadas' 
    : 'Entradas agendadas';
  
  const saldoProjetadoTooltip = isCompetencia
    ? 'Pagas + Agendadas + Saldo a receber das sessões do período − Despesas (pagas, faturadas e agendadas)'
    : 'Pagas + Agendadas − Despesas (pagas, faturadas e agendadas)';

  const aReceberTooltip = isCompetencia
    ? 'Inclui o saldo restante das sessões do período (valor total − valor já pago) somado às entradas agendadas.'
    : 'Soma das entradas com status Agendado no período.';

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
        subtitle="Pagas + a receber − despesas"
        icon={AlertCircle}
        iconBgClass="bg-purple-500"
        valueColorClass={resumo.saldoProjetado >= 0 
          ? "text-emerald-600 dark:text-emerald-400" 
          : "text-red-600 dark:text-red-400"
        }
        tooltip={saldoProjetadoTooltip}
      />

      {/* TOTAL A RECEBER */}
      <SummaryCard
        title="A Receber"
        value={resumo.totalAReceber}
        subtitle={aReceberSubtitle}
        icon={CheckCircle}
        iconBgClass="bg-yellow-500"
        valueColorClass="text-yellow-600 dark:text-yellow-400"
        tooltip={aReceberTooltip}
      />
    </div>
  );
}
