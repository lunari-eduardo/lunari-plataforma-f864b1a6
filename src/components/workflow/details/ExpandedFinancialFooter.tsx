import React from "react";
import { Calculator, CheckCircle2, Clock } from "lucide-react";

interface Props {
  total: number;
  valorPago: number;
  pendente: number;
  formatCurrency: (v: any) => string;
  creditSlot?: React.ReactNode;
}

/**
 * Footer financeiro com 3 métricas em alto destaque (TOTAL, PAGO, PENDENTE).
 * Remove o pagamento rápido conforme solicitado para evitar ambiguidades.
 */
export function ExpandedFinancialFooter({
  total,
  valorPago,
  pendente,
  formatCurrency,
  creditSlot,
}: Props) {
  const isPendentePositivo = pendente > 0.001;

  return (
    <div className="mt-5 rounded-2xl border border-stone-200/60 dark:border-border/40 bg-card/40 dark:bg-card/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          {/* TOTAL */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#F5EDE1] dark:bg-[#342A1D] text-[#8C6B3F] dark:text-[#E5C497] flex items-center justify-center shrink-0 shadow-2xs">
              <Calculator className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Total
              </span>
              <span className="text-xl sm:text-2xl font-black tabular-nums text-foreground tracking-tight leading-tight">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* PAGO */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E8F6ED] dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Pago
              </span>
              <span className="text-xl sm:text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight leading-tight">
                {formatCurrency(valorPago)}
              </span>
            </div>
          </div>

          {/* PENDENTE */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FAF0E6] dark:bg-amber-950/40 text-[#C04A2A] dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Pendente
              </span>
              <span
                className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight leading-tight ${
                  isPendentePositivo
                    ? "text-[#C04A2A] dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatCurrency(pendente)}
              </span>
            </div>
          </div>
        </div>

        {creditSlot && (
          <div className="shrink-0">
            {creditSlot}
          </div>
        )}
      </div>
    </div>
  );
}
