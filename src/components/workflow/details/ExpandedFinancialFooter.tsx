import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { HAIRLINE, LABEL_CLS } from "./cardTokens";

interface Props {
  total: number;
  valorPago: number;
  pendente: number;
  paymentInput: string;
  setPaymentInput: (v: string) => void;
  onPaymentAdd: () => void;
  onPaymentKeyDown: (e: React.KeyboardEvent) => void;
  formatCurrency: (v: any) => string;
  creditSlot?: React.ReactNode;
}

/**
 * Footer financeiro reformulado — tokens semânticos, hairlines verticais
 * entre métricas, tipografia editorial.
 */
export function ExpandedFinancialFooter({
  total,
  valorPago,
  pendente,
  paymentInput,
  setPaymentInput,
  onPaymentAdd,
  onPaymentKeyDown,
  formatCurrency,
  creditSlot,
}: Props) {
  return (
    <div className={`mt-8 pt-5 border-t ${HAIRLINE}`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-stretch divide-x divide-border/20">
          <div className="flex flex-col pr-6">
            <span className={LABEL_CLS}>Total</span>
            <span className="text-[20px] font-semibold tabular-nums text-foreground leading-tight">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex flex-col px-6">
            <span className={LABEL_CLS}>Pago</span>
            <span className="text-[20px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatCurrency(valorPago)}
            </span>
          </div>
          <div className="flex flex-col pl-6">
            <span className={LABEL_CLS}>Pendente</span>
            <span
              className={`text-[20px] font-semibold tabular-nums leading-tight ${
                pendente > 0.001
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formatCurrency(pendente)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 items-end">
          <span className={LABEL_CLS}>Pagamento rápido</span>
          <div className="flex items-center gap-2">
            {creditSlot}
            <div className="flex items-center rounded-lg border border-border/50 bg-muted/25 dark:bg-muted/35 hover:border-border/80 focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:bg-background transition-all shadow-2xs p-0.5">
              <span className="px-2.5 py-1 text-xs font-semibold text-muted-foreground select-none">
                R$
              </span>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                onKeyDown={onPaymentKeyDown}
                className="h-7 w-24 bg-transparent border-0 text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus:outline-none px-1 tabular-nums [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-none"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                onClick={onPaymentAdd}
                className="h-7 px-2.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white gap-1 text-xs font-medium shadow-none transition-all"
                aria-label="Adicionar pagamento rápido"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Adicionar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
