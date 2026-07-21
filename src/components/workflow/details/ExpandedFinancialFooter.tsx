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

        <div className="flex flex-col gap-1 items-end">
          <span className={LABEL_CLS}>Pagamento rápido</span>
          <div className="flex items-center gap-2">
            {creditSlot}
            <div className="flex items-center gap-1">
              <span className="text-[12px] text-muted-foreground">R$</span>
              <Input
                type="number"
                placeholder="0,00"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                onKeyDown={onPaymentKeyDown}
                className="h-8 text-[13px] w-24 bg-transparent border-0 border-b border-border/25 hover:border-border/50 focus:border-primary/50 focus-visible:ring-0 rounded-none px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onPaymentAdd}
              className="h-8 w-8 p-0 rounded-md border-border/25 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-600"
              aria-label="Adicionar pagamento"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
