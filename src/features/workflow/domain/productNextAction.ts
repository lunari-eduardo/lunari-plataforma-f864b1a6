/**
 * Resumo operacional inteligente da coluna Produtos do Workflow.
 *
 * v2 — respeita o novo estado `pending | in_progress | done`. NUNCA anuncia
 * a "próxima" etapa: sempre mostra o estado ATUAL do produto.
 *  - pending      → "A produzir"
 *  - in_progress  → nome da etapa atual (primeiro !done)
 *  - done         → "Entregue" / "Entregues"
 */
import {
  hydrateProduto,
  isEntregue,
  etapaAtualIndex,
  isProdutoStarted,
  type ProdutoWorkflowFlow,
} from "./productFlow";

export type ProductNextTone = "muted" | "info" | "warn" | "done";

export interface ProductTooltipRow {
  nome: string;
  etapa: string;
  entregue: boolean;
}

export interface ProductNextAction {
  total: number;
  entregues: number;
  emProducao: number;
  aProduzir: number;
  pendentes: number;
  label: string;
  tone: ProductNextTone;
  dotClass: string;
  tooltip: ProductTooltipRow[];
  allDone: boolean;
}

const EMPTY: ProductNextAction = {
  total: 0,
  entregues: 0,
  emProducao: 0,
  aProduzir: 0,
  pendentes: 0,
  label: "",
  tone: "muted",
  dotClass: "bg-muted-foreground/40",
  tooltip: [],
  allDone: false,
};

export function computeProductNextAction(
  items: ProdutoWorkflowFlow[] | undefined | null,
): ProductNextAction {
  const list = (items ?? []).map((p) => hydrateProduto(p));
  const total = list.length;
  if (total === 0) return EMPTY;

  let entregues = 0;
  let emProducao = 0;
  let aProduzir = 0;

  const tooltip: ProductTooltipRow[] = [];
  const rotulosAtuais: string[] = [];

  for (const p of list) {
    const et = p.etapas ?? [];
    const entregue = isEntregue(et);
    if (entregue) {
      entregues++;
      tooltip.push({ nome: p.nome, etapa: "Entregue", entregue: true });
      continue;
    }
    if (!isProdutoStarted(p)) {
      aProduzir++;
      tooltip.push({ nome: p.nome, etapa: "A produzir", entregue: false });
      rotulosAtuais.push("A produzir");
      continue;
    }
    const idx = etapaAtualIndex(et);
    const etapaAtualNome = et[idx]?.nome ?? "Em produção";
    emProducao++;
    tooltip.push({ nome: p.nome, etapa: etapaAtualNome, entregue: false });
    rotulosAtuais.push(etapaAtualNome);
  }

  const pendentes = total - entregues;

  // Todos entregues.
  if (entregues === total) {
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: total > 1 ? "Entregues" : "Entregue",
      tone: "done",
      dotClass: "bg-emerald-500",
      tooltip,
      allDone: true,
    };
  }

  // Único pendente → rótulo do estado atual dele.
  if (pendentes === 1) {
    const nome = rotulosAtuais[0] || "A produzir";
    const isPending = nome === "A produzir";
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: nome,
      tone: isPending ? "warn" : "info",
      dotClass: isPending ? "bg-slate-400" : "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }

  // Todos pendentes no mesmo rótulo.
  const unico = rotulosAtuais.every((n) => n === rotulosAtuais[0]) ? rotulosAtuais[0] : null;
  if (unico) {
    const isPending = unico === "A produzir";
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: unico,
      tone: isPending ? "warn" : "info",
      dotClass: isPending ? "bg-slate-400" : "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }

  // Divergentes — resumo agregado, sempre descrevendo estado atual.
  if (entregues > 0) {
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: `${pendentes} pendente${pendentes > 1 ? "s" : ""}`,
      tone: "warn",
      dotClass: "bg-amber-500",
      tooltip,
      allDone: false,
    };
  }
  if (emProducao > 0 && aProduzir > 0) {
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: `${emProducao} em produção · ${aProduzir} a produzir`,
      tone: "info",
      dotClass: "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }
  if (emProducao > 0) {
    return {
      total, entregues, emProducao, aProduzir, pendentes,
      label: emProducao === total ? "Em produção" : `${emProducao} em produção`,
      tone: "info",
      dotClass: "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }
  return {
    total, entregues, emProducao, aProduzir, pendentes,
    label: "A produzir",
    tone: "warn",
    dotClass: "bg-slate-400",
    tooltip,
    allDone: false,
  };
}
