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
  TrendingUp,
  Building2,
  Briefcase,
  Receipt,
  UserRound,
  Coins,
  Banknote,
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

  return (
    <section aria-label="Composição de gastos por natureza" className="animate-fade-in">
      <Card className="glass rounded-2xl shadow-card-subtle">
        <CardHeader className="pb-4 flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Composição de Gastos</CardTitle>
            <p className="text-xs text-lunar-textSecondary mt-1">
              Saídas do período por natureza contábil — independente do nome da categoria.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-lunar-textSecondary">Lucro líquido</div>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <div
                className={`text-xl font-bold mt-1 ${
                  (data?.lucroLiquido ?? 0) >= 0 ? "text-lunar-success" : "text-destructive"
                }`}
              >
                {formatCurrency(data?.lucroLiquido ?? 0)}
              </div>
            )}
            {!isLoading && data && (
              <div className="text-[11px] text-lunar-textSecondary">
                Margem {data.margemLiquida.toFixed(1)}%
              </div>
            )}
          </div>
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
                const total = data?.gastos.total ?? 0;
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

          {!isLoading && data && data.gastos.total === 0 && (
            <p className="text-sm text-lunar-textSecondary text-center mt-4">
              Nenhum gasto registrado no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
});

export default DashboardGastosBreakdown;
