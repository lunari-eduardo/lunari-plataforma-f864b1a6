import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { MonthlyPhotoProduction } from "@/hooks/useWorkflowPhotoProduction";

interface Props {
  monthly: MonthlyPhotoProduction[];
  isLoading?: boolean;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function ProductionByMonthChart({ monthly, isLoading }: Props) {
  const data = useMemo(
    () =>
      monthly.map((m) => ({
        mes: MONTH_LABELS[m.month - 1],
        Inclusas: m.fotosIncluidas,
        Extras: m.fotosExtras,
        Total: m.fotosTotal,
      })),
    [monthly],
  );

  return (
    <div className="rounded-lg bg-card/30 backdrop-blur-lg dark:bg-card/[0.04] border border-white/50 dark:border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fotos por mês</h3>
          <p className="text-xs text-muted-foreground">Produção prevista: fotos inclusas no pacote + extras</p>
        </div>
      </div>
      <div className="h-[280px]">
        {isLoading ? (
          <div className="h-full w-full rounded-md bg-muted/40 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [new Intl.NumberFormat("pt-BR").format(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Inclusas" stackId="fotos" fill="hsl(210 90% 55%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Extras" stackId="fotos" fill="hsl(200 80% 70%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
