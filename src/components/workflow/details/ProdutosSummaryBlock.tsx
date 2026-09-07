import React from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hydrateProduto,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";
import { ProdutoFlowMiniTimeline } from "./ProdutoFlowMiniTimeline";

interface Props {
  produtos: ProdutoWorkflowFlow[] | undefined | null;
  onOpenManager: () => void;
  formatCurrency: (v: number) => string;
}

/**
 * Resumo compacto (sem imagens/cadastro) dos produtos vendidos na sessão.
 * Leitura + gatilho único para o GerenciarProdutosModal (mesma instância
 * hospedada em `CardCollapsedModals`).
 */
export function ProdutosSummaryBlock({
  produtos,
  onOpenManager,
  formatCurrency,
}: Props) {
  const list = (produtos ?? []).map((p) => hydrateProduto(p));

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-2 my-auto">
        <div className="w-12 h-12 rounded-full bg-[#F7F2EB] dark:bg-stone-800/60 border border-[#EAE0D1] dark:border-stone-700/60 flex items-center justify-center text-[#8C6D46] dark:text-amber-400 shrink-0 shadow-2xs">
          <Package className="h-6 w-6 stroke-[1.5]" />
        </div>
        <span className="text-xs text-muted-foreground">
          Nenhum produto nesta sessão.
        </span>
        <button
          type="button"
          onClick={onOpenManager}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#A68656]/60 dark:border-amber-800/60 text-xs font-semibold text-[#6E4F28] dark:text-amber-300 hover:bg-[#FDFBF7] dark:hover:bg-amber-950/20 transition-all cursor-pointer shadow-2xs"
        >
          + Adicionar produto
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-[220px] overflow-y-auto pr-1 -mr-1 divide-y divide-border/10">
      {list.map((p, i) => {
        const key = p.id || p.produtoId || `${p.nome}-${i}`;
        const isIncluso = p.tipo === "incluso";
        const subtotal = isIncluso ? 0 : (p.valorUnitario || 0) * (p.quantidade || 0);
        return (
          <button
            key={key}
            type="button"
            onClick={onOpenManager}
            className={cn(
              "w-full text-left py-1.5 flex flex-col gap-1",
              "hover:bg-muted/30 -mx-2 px-2 rounded transition-colors",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              <span
                className="text-[12px] text-foreground truncate flex-1 min-w-0"
                title={p.nome}
              >
                {p.nome}
              </span>
              {isIncluso && (
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
                  Incluso
                </span>
              )}
              <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                ×{p.quantidade || 0}
              </span>
              <span className="text-[11px] tabular-nums font-medium text-foreground shrink-0 w-16 text-right">
                {isIncluso ? "—" : formatCurrency(subtotal)}
              </span>
            </div>
            {p.etapas && p.etapas.length > 0 && (
              <div className="pl-5">
                <ProdutoFlowMiniTimeline etapas={p.etapas} started={!!p.started} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
