
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndicadoresFinanceiros } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { DollarSign, TrendingUp } from "lucide-react";

interface IndicadoresFinanceirosProps {
  indicadores: IndicadoresFinanceiros;
}

export default function IndicadoresFinanceirosComponent({ indicadores }: IndicadoresFinanceirosProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            Custo Total (Faturado)
          </CardTitle>
          <div className="bg-destructive p-2 rounded-md text-destructive-foreground">
            <DollarSign className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(indicadores.custoTotal)}
          </p>
          <p className="text-xs text-neumorphic-textLight">
            Despesas já pagas este mês
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            Custo Previsto
          </CardTitle>
          <div className="bg-lunar-warning p-2 rounded-md text-lunar-accent-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-lunar-warning">
            {formatCurrency(indicadores.custoPrevisto)}
          </p>
          <p className="text-xs text-neumorphic-textLight">
            Total planejado para este mês
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
