import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeProductProgress } from "@/features/workflow/domain/productProgress";
import type { ProdutoWorkflowFlow } from "@/features/workflow/domain/productFlow";

interface Props {
  produtos: ProdutoWorkflowFlow[] | undefined | null;
  onClick: () => void;
}

/**
 * Indicador do card colapsado — mostra "N" + label de estado + dot colorido.
 */
export function ProductStatusChip({ produtos, onClick }: Props) {
  const progress = computeProductProgress(produtos ?? undefined);
  const hasProdutos = progress.total > 0;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-8 min-w-[60px] max-w-[160px] px-2.5 text-xs border rounded-md bg-background hover:bg-muted flex items-center gap-1.5"
    >
      <Package
        className={cn("h-3.5 w-3.5 shrink-0", hasProdutos ? "text-primary" : "text-muted-foreground")}
      />
      <span className="tabular-nums font-medium">{progress.total}</span>
      {hasProdutos && progress.label && (
        <>
          <span className="text-muted-foreground/60 leading-none">•</span>
          <span className="text-[10px] text-muted-foreground truncate">{progress.label}</span>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", progress.dotClass)} />
        </>
      )}
    </Button>
  );
}
