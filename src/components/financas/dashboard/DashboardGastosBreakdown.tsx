/**
 * Onda D — Composição de Gastos por Natureza.
 *
 * Mostra o lucro líquido e o detalhamento dos gastos do período
 * separados por Natureza (Operacional, Investimentos, Impostos,
 * Pró-labore, Distribuição, Financiamentos) usando a capability
 * `finance.kpi.byNatureRange` como fonte única de verdade.
 */
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  Building2,
  Briefcase,
  Receipt,
  UserRound,
  Coins,
  Banknote,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/utils/financialUtils";
import { useCapabilityQuery } from "@/shared/capability/react";
import { kpisByNatureRange } from "@/modules/finance/application/queries/kpisByNatureRange";

interface Props {
  startDate: string;
  endDate: string;
}

const ICON_BY_NATURE: Record<string, React.ComponentType<{ className?: string }>> = {
  despesa_operacional: Building2,
  investimento_ativos: Briefcase,
  impostos: Receipt,
  pro_labore: UserRound,
  distribuicao_lucros: Coins,
  financiamento: Banknote,
};

export const DashboardGastosBreakdown = memo(function DashboardGastosBreakdown({
  startDate,
  endDate,
}: Props) {
  const { data, isLoading } = useCapabilityQuery(
    kpisByNatureRange,
    { start: startDate, end: endDate },
    {
      queryKey: ["finance", "kpisByNatureRange", startDate, endDate] as const,
      staleTime: 1000 * 60 * 2,
    },
  );

  const total = data?.gastos.total ?? 0;

  return (
    <section aria-label="Composição de gastos por natureza" className="animate-fade-in">
      <Card className="glass rounded-2xl shadow-card-subtle">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">Composição de Gastos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Sobre o cálculo" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  Soma apenas <strong>despesas pagas</strong> do período (regime caixa),
                  agrupadas por natureza contábil. Mesmo critério das métricas do topo —
                  o total daqui é igual ao card <em>"Total Despesas"</em>.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-lunar-textSecondary mt-1">
            Total pago: <strong>{formatCurrency(total)}</strong> no período selecionado.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                { key: "despesa_operacional", label: "Operacional", value: data?.gastos.operacional ?? 0 },
                { key: "investimento_ativos", label: "Investimentos", value: data?.gastos.investimentos ?? 0 },
                { key: "impostos", label: "Impostos", value: data?.gastos.impostos ?? 0 },
                { key: "pro_labore", label: "Pró-labore", value: data?.gastos.proLabore ?? 0 },
                { key: "distribuicao_lucros", label: "Distribuição", value: data?.gastos.distribuicao ?? 0 },
                { key: "financiamento", label: "Financiamentos", value: data?.gastos.financiamentos ?? 0 },
              ].map(({ key, label, value }) => {
                const Icon = ICON_BY_NATURE[key] ?? TrendingUp;
                const pct = total > 0 ? (value / total) * 100 : 0;
                return (
                  <div key={key} className="interactive-surface relative p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-lunar-textSecondary font-medium">{label}</span>
                      <div className="p-2 rounded-lg bg-primary/15">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-destructive mt-2">
                      -{formatCurrency(value)}
                    </div>
                    <div className="text-[11px] text-lunar-textSecondary mt-1">
                      {pct.toFixed(1)}% dos gastos
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && total === 0 && (
            <p className="text-sm text-lunar-textSecondary text-center mt-4">
              Nenhum gasto pago no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
});

export default DashboardGastosBreakdown;
