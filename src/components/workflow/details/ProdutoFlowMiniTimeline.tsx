import React from "react";
import { cn } from "@/lib/utils";
import {
  etapaAtualIndex,
  isEntregue,
  type EtapaProducao,
} from "@/features/workflow/domain/productFlow";

interface Props {
  etapas: EtapaProducao[];
  /** Estado explícito — quando `false`, mostra "A produzir" como rótulo. */
  started?: boolean;
}

/**
 * Visualização horizontal minimalista das etapas de produção de um produto.
 * v2: respeita o estado pending — nunca sugere a "próxima" etapa quando o
 * produto ainda não foi iniciado.
 */
export function ProdutoFlowMiniTimeline({ etapas, started = true }: Props) {
  if (!etapas || etapas.length === 0) return null;

  const entregue = isEntregue(etapas);
  const currentIdx = etapaAtualIndex(etapas);
  const label = entregue
    ? "Entregue"
    : !started
      ? "A produzir"
      : etapas[currentIdx]?.nome ?? "Em produção";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-0.5 shrink-0">
        {etapas.map((e, i) => {
          const isDone = e.done;
          const isCurrent = started && !entregue && i === currentIdx;
          return (
            <React.Fragment key={e.id}>
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  isDone
                    ? "bg-primary"
                    : isCurrent
                      ? "bg-primary/50 ring-2 ring-primary/20"
                      : !started
                        ? "bg-border/60"
                        : "bg-border",
                )}
              />
              {i < etapas.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-3",
                    isDone ? "bg-primary/60" : "bg-border/60",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <span
        className={cn(
          "text-[10px] truncate min-w-0",
          entregue
            ? "text-emerald-600 dark:text-emerald-400"
            : !started
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
        )}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
