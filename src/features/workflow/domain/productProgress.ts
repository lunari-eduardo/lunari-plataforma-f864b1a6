import { hydrateProduto, isEntregue, etapaAtualIndex, type ProdutoWorkflowFlow } from "./productFlow";

export type ProductProgressTone = "muted" | "slate" | "blue" | "amber" | "green";

export interface ProductProgress {
  total: number;
  entregues: number;
  emProducao: number;
  aProduzir: number;
  pendentes: number;
  label: string;
  tone: ProductProgressTone;
  dotClass: string;
}

/** Resumo de produção usado no chip do card colapsado. */
export function computeProductProgress(items: ProdutoWorkflowFlow[] | undefined | null): ProductProgress {
  const arr = (items ?? []).map((p) => hydrateProduto(p));
  const total = arr.length;
  if (total === 0) {
    return {
      total: 0, entregues: 0, emProducao: 0, aProduzir: 0, pendentes: 0,
      label: "", tone: "muted", dotClass: "bg-muted-foreground/40",
    };
  }
  let entregues = 0;
  let emProducao = 0;
  let aProduzir = 0;
  for (const p of arr) {
    const et = p.etapas ?? [];
    if (isEntregue(et)) { entregues++; continue; }
    const idx = etapaAtualIndex(et);
    if (idx <= 0) aProduzir++;
    else emProducao++;
  }
  const pendentes = total - entregues;

  if (entregues === total) {
    return { total, entregues, emProducao, aProduzir, pendentes,
      label: "Entregue", tone: "green", dotClass: "bg-emerald-500" };
  }
  if (entregues > 0) {
    return { total, entregues, emProducao, aProduzir, pendentes,
      label: `${pendentes} pendente${pendentes > 1 ? "s" : ""}`, tone: "amber", dotClass: "bg-amber-500" };
  }
  if (emProducao > 0) {
    return { total, entregues, emProducao, aProduzir, pendentes,
      label: "Produção", tone: "blue", dotClass: "bg-sky-500" };
  }
  return { total, entregues, emProducao, aProduzir, pendentes,
    label: "A produzir", tone: "slate", dotClass: "bg-slate-400" };
}
