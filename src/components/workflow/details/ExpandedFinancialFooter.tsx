import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface Props {
  total: number;
  valorPago: number;
  pendente: number;
  paymentInput: string;
  setPaymentInput: (v: string) => void;
  onPaymentAdd: () => void;
  onPaymentKeyDown: (e: React.KeyboardEvent) => void;
  formatCurrency: (v: any) => string;
  /** Slot opcional exibido à esquerda do input de pagamento rápido. */
  creditSlot?: React.ReactNode;
}

/**
 * Footer financeiro do card expandido com input de pagamento rápido.
 * Mostra apenas as métricas principais (total/pago/pendente); qualquer
 * detalhamento de extras vive no bloco "Adicionais" acima.
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
    <div className="mt-6 pt-4 border-t border-border/30 dark:border-border/50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 md:gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
            <span className="text-lg font-bold text-blue-700">{formatCurrency(total)}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago</span>
            <span className="text-lg font-bold text-green-600">{formatCurrency(valorPago)}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendente</span>
            <span
              className={`text-lg font-bold ${
                pendente > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatCurrency(pendente)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {creditSlot}
          <span className="text-xs text-muted-foreground hidden md:inline">Adic. Pag. Rápido</span>
          <div className="flex items-center border border-border/50 dark:border-border rounded-md bg-background/50 dark:bg-background/80">
            <span className="text-sm text-muted-foreground pl-2">R$</span>
            <Input
              type="number"
              placeholder="0,00"
              value={paymentInput}
              onChange={(e) => setPaymentInput(e.target.value)}
              onKeyDown={onPaymentKeyDown}
              className="h-8 text-sm w-20 border-0 focus-visible:ring-0 bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoComplete="off"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPaymentAdd}
            className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300 hover:text-green-600"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
