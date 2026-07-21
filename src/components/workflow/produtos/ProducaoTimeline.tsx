import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  etapaAtualIndex,
  isEntregue,
  type EtapaProducao,
} from "@/features/workflow/domain/productFlow";

interface Props {
  etapas: EtapaProducao[];
  onToggle: (index: number) => void;
}

/**
 * Timeline horizontal executiva com labels duplos (nome + status).
 * - Nó `done`: círculo preenchido com check.
 * - Nó `atual` (primeiro !done): círculo com anel duplo (target look).
 * - Nó futuro: círculo cinza pequeno.
 */
export function ProducaoTimeline({ etapas, onToggle }: Props) {
  if (!etapas || etapas.length === 0) return null;
  const atualIdx = etapaAtualIndex(etapas);
  const entregue = isEntregue(etapas);

  return (
    <div className="w-full overflow-x-auto scrollbar-elegant">
      <div className="flex items-start min-w-max px-1">
        {etapas.map((etapa, i) => {
          const done = etapa.done;
          const isCurrent = !entregue && i === atualIdx;
          const status = done ? "Concluída" : isCurrent ? "Atual" : "Pendente";
          const statusColor = done
            ? "text-emerald-600 dark:text-emerald-400"
            : isCurrent
              ? "text-primary"
              : "text-muted-foreground";
          return (
            <React.Fragment key={etapa.id}>
              <div className="flex flex-col items-center gap-1.5 min-w-[92px]">
                <button
                  type="button"
                  onClick={() => onToggle(i)}
                  aria-label={`Alternar etapa ${etapa.nome}`}
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    done && "h-6 w-6 bg-emerald-500 text-white shadow-sm",
                    isCurrent &&
                      "h-6 w-6 bg-primary text-primary-foreground ring-4 ring-primary/15",
                    !done && !isCurrent && "h-4 w-4 bg-muted border border-border/60 hover:bg-muted/80",
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  {isCurrent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </button>
                <div className="flex flex-col items-center gap-0.5 leading-tight">
                  <span
                    className={cn(
                      "text-[11px] font-medium text-center max-w-[92px] truncate",
                      done && "text-emerald-700 dark:text-emerald-400",
                      isCurrent && "text-primary",
                      !done && !isCurrent && "text-foreground/80",
                    )}
                    title={etapa.nome}
                  >
                    {etapa.nome}
                  </span>
                  <span className={cn("text-[10px]", statusColor)}>{status}</span>
                </div>
              </div>
              {i < etapas.length - 1 && (
                <div className="flex-1 min-w-[24px] pt-3">
                  <span
                    aria-hidden
                    className={cn(
                      "block h-px w-full",
                      done ? "bg-emerald-500/60" : "bg-border",
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
