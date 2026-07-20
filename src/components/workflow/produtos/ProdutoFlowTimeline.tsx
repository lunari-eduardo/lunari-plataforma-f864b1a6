import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { etapaAtualIndex, type EtapaProducao } from "@/features/workflow/domain/productFlow";

interface Props {
  etapas: EtapaProducao[];
  onToggle: (index: number) => void;
}

/**
 * Timeline horizontal das etapas de produção.
 * - Check verde: etapa concluída.
 * - Dot preenchido (primary): etapa atual.
 * - Círculo vazio: etapa futura.
 * Clique em uma etapa marca ela + anteriores como concluídas.
 */
export function ProdutoFlowTimeline({ etapas, onToggle }: Props) {
  const atualIdx = etapaAtualIndex(etapas);

  return (
    <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap sm:overflow-x-auto scrollbar-elegant py-1">
      {etapas.map((etapa, i) => {
        const done = etapa.done;
        const isCurrent = i === atualIdx;
        return (
          <div key={etapa.id} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggle(i)}
              aria-label={`Alternar etapa ${etapa.nome}`}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors",
                done && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
                !done && isCurrent && "bg-primary/10 border-primary/40 text-primary",
                !done && !isCurrent && "bg-muted/40 border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-4 w-4 rounded-full border",
                  done && "bg-emerald-500 border-emerald-500 text-white",
                  !done && isCurrent && "bg-primary border-primary",
                  !done && !isCurrent && "bg-transparent border-muted-foreground/40",
                )}
              >
                {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className="text-[11px] font-medium whitespace-nowrap">{etapa.nome}</span>
            </button>
            {i < etapas.length - 1 && (
              <span className="h-px w-3 bg-border shrink-0" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
