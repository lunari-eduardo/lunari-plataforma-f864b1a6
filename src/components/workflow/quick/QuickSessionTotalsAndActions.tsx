import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  totalFotosExtraManual: string;
  totalProdutos: number;
  totalSessao: number;
  valorPago: string;
  restante: number;
  formatCurrency: (v: any) => string;
  isSubmitting: boolean;
  onClose: () => void;
  onClear: () => void;
  onSubmitAndAdd: () => void;
  onSubmit: () => void;
}

export function QuickSessionTotalsAndActions({
  totalFotosExtraManual, totalProdutos, totalSessao, valorPago, restante,
  formatCurrency, isSubmitting, onClose, onClear, onSubmitAndAdd, onSubmit,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-end gap-6 p-3 bg-muted/50 rounded-md border flex-wrap">
        <div className="text-xs">
          <span className="text-muted-foreground">Total Fotos:</span>{" "}
          <span className="font-semibold">{formatCurrency(parseFloat(totalFotosExtraManual) || 0)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Total Produtos:</span>{" "}
          <span className="font-semibold">{formatCurrency(totalProdutos)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">TOTAL SESSÃO:</span>{" "}
          <span className="font-bold text-lg">{formatCurrency(totalSessao)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Pago:</span>{" "}
          <span className="font-semibold text-green-600">{formatCurrency(parseFloat(valorPago) || 0)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Restante:</span>{" "}
          <span className={cn("font-semibold", restante > 0 ? "text-orange-600" : "text-green-600")}>
            {formatCurrency(restante)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Keyboard className="h-3 w-3" />
          <span>
            <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Ctrl</kbd>+
            <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Enter</kbd> salvar
            · <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Ctrl</kbd>+
            <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">P</kbd> produto
            · <kbd className="px-1 py-0.5 bg-muted border rounded text-2xs">Esc</kbd> fechar
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" onClick={onClear}>
                Limpar
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">Atalho: Ctrl + L</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSubmitAndAdd}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar e Adicionar Outra"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">Atalho: Ctrl + Shift + Enter</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Salvando..." : "Salvar Sessão"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">Atalho: Ctrl + Enter</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
