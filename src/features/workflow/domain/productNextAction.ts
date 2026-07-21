/**
 * Resumo operacional inteligente da coluna Produtos do Workflow.
 *
 * Responde à pergunta do fotógrafo: "existe pendência? qual a próxima ação?".
 * Nunca substitui o status da sessão — trata apenas do andamento da produção
 * dos produtos vendidos na sessão.
 */
import {
  hydrateProduto,
  isEntregue,
  etapaAtualIndex,
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
  const proximasEtapas: string[] = [];

  for (const p of list) {
    const et = p.etapas ?? [];
    const entregue = isEntregue(et);
    if (entregue) {
      entregues++;
      tooltip.push({ nome: p.nome, etapa: "Entregue", entregue: true });
      continue;
    }
    const idx = etapaAtualIndex(et);
    const etapaAtualNome = et[idx]?.nome ?? "Pendente";
    proximasEtapas.push(etapaAtualNome);
    if (idx <= 0) aProduzir++;
    else emProducao++;
    tooltip.push({ nome: p.nome, etapa: etapaAtualNome, entregue: false });
  }

  const pendentes = total - entregues;

  // Todos entregues.
  if (entregues === total) {
    return {
      total,
      entregues,
      emProducao,
      aProduzir,
      pendentes,
      label: total > 1 ? "Entregues" : "Entregue",
      tone: "done",
      dotClass: "bg-emerald-500",
      tooltip,
      allDone: true,
    };
  }

  // Um único produto pendente → mostra o nome da próxima etapa dele.
  if (pendentes === 1) {
    const nome = proximasEtapas[0] || "Pendente";
    return {
      total,
      entregues,
      emProducao,
      aProduzir,
      pendentes,
      label: nome,
      tone: emProducao > 0 || entregues > 0 ? "info" : "warn",
      dotClass: emProducao > 0 || entregues > 0 ? "bg-sky-500" : "bg-amber-500",
      tooltip,
      allDone: false,
    };
  }

  // Vários pendentes convergindo na mesma próxima etapa.
  const unicaEtapa = proximasEtapas.every((n) => n === proximasEtapas[0])
    ? proximasEtapas[0]
    : null;
  if (unicaEtapa) {
    return {
      total,
      entregues,
      emProducao,
      aProduzir,
      pendentes,
      label: unicaEtapa,
      tone: "info",
      dotClass: "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }

  // Divergentes: resumo agregado.
  if (entregues > 0) {
    return {
      total,
      entregues,
      emProducao,
      aProduzir,
      pendentes,
      label: `${pendentes} pendência${pendentes > 1 ? "s" : ""}`,
      tone: "warn",
      dotClass: "bg-amber-500",
      tooltip,
      allDone: false,
    };
  }
  if (emProducao > 0) {
    return {
      total,
      entregues,
      emProducao,
      aProduzir,
      pendentes,
      label:
        emProducao === total
          ? "Produção"
          : `${emProducao} em produção`,
      tone: "info",
      dotClass: "bg-sky-500",
      tooltip,
      allDone: false,
    };
  }
  return {
    total,
    entregues,
    emProducao,
    aProduzir,
    pendentes,
    label: "A produzir",
    tone: "warn",
    dotClass: "bg-slate-400",
    tooltip,
    allDone: false,
  };
}
