import { Package, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeProductNextAction } from "@/features/workflow/domain/productNextAction";
import type { ProdutoWorkflowFlow } from "@/features/workflow/domain/productFlow";

interface Props {
  produtos: ProdutoWorkflowFlow[] | undefined | null;
  onClick: () => void;
}

/**
 * Chip da coluna "Produtos" do card colapsado do Workflow.
 *
 * NÃO reflete o status da sessão — trata exclusivamente do andamento dos
 * produtos vendidos. Duas linhas: quantidade + próxima ação (ou resumo
 * inteligente quando existem vários produtos com etapas distintas).
 */
export function ProductStatusChip({ produtos, onClick }: Props) {
  const info = computeProductNextAction(produtos ?? undefined);
  const hasProdutos = info.total > 0;
  const hasPendencia = hasProdutos && !info.allDone;
  const allDone = hasProdutos && info.allDone;

  const toneBorder = allDone
    ? "border-emerald-500/25"
    : hasPendencia
      ? info.tone === "warn"
        ? "border-amber-500/35"
        : "border-primary/25"
      : "border-border/30";

  const toneBg = allDone
    ? "hover:bg-emerald-500/[0.04]"
    : hasPendencia
      ? "bg-primary/[0.02] hover:bg-primary/[0.05]"
      : "hover:bg-muted/40";

  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center gap-0.5",
        "h-11 min-w-[76px] max-w-[132px] px-2.5 py-1",
        "rounded-lg border bg-transparent transition-colors",
        toneBorder,
        toneBg,
      )}
    >
      {/* Linha 1: ícone + quantidade */}
      <div className="flex items-center gap-1.5 leading-none">
        {allDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Package
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              hasPendencia ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}
        <span
          className={cn(
            "text-[13px] font-semibold tabular-nums leading-none",
            hasProdutos ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {hasProdutos ? info.total : "—"}
        </span>
      </div>

      {/* Linha 2: próxima ação / resumo */}
      {hasProdutos && info.label && (
        <div className="flex items-center gap-1 leading-none max-w-full">
          <span
            className="text-[10px] font-medium text-muted-foreground truncate"
            title={info.label}
          >
            {info.label}
          </span>
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", info.dotClass)}
          />
        </div>
      )}
    </button>
  );

  if (!hasProdutos) return button;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="p-0 border-border/60">
          <div className="px-3 py-2 min-w-[200px]">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Produção da sessão
            </div>
            <div className="space-y-1">
              {info.tooltip.slice(0, 5).map((row, i) => (
                <div
                  key={`${row.nome}-${i}`}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="truncate text-foreground">{row.nome}</span>
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      row.entregue
                        ? "text-emerald-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {row.entregue ? "✓ Entregue" : row.etapa}
                  </span>
                </div>
              ))}
              {info.tooltip.length > 5 && (
                <div className="text-[10px] text-muted-foreground pt-1">
                  …e mais {info.tooltip.length - 5}
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
