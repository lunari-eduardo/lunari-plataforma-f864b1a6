/**
 * Domínio: fluxo de produção por produto do Workflow.
 *
 * Cada produto da sessão possui uma lista de etapas (`etapas`). A "etapa
 * atual" é o primeiro item com `done === false`. Se todas estão `done`, o
 * produto está entregue.
 *
 * Retro-compat: itens legados só têm `produzido`/`entregue`. Ao ler,
 * hidratamos as `etapas` a partir desses flags.
 */

export type EtapaProducao = {
  id: string;
  nome: string;
  done: boolean;
};

export type FluxoProducao = "padrao" | "custom";

export interface ProdutoWorkflowFlow {
  id?: string;
  produtoId?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: "incluso" | "manual";
  fluxo?: FluxoProducao;
  etapas?: EtapaProducao[];
  /** Prazo de entrega opcional por produto (ISO YYYY-MM-DD). */
  prazoEntrega?: string;
  // Legado — mantido como espelho derivado na escrita.
  produzido?: boolean;
  entregue?: boolean;
}

export const ETAPAS_PADRAO_NOMES = ["A produzir", "Em produção", "Entregue"] as const;
export const CUSTOM_FLOW_DEFAULT = ["Diagramação", "Aprovação", "Laboratório", "Entrega"];

const slugId = (prefix: string, nome: string, i: number) =>
  `${prefix}_${i}_${nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;

/**
 * Id determinístico para produtos legados que não têm `id` persistido
 * (ex.: vendas avulsas antigas, importações). Estável entre reconciliações
 * — sessão+nome+índice — para que a dedup por tag `produto:<id>` funcione.
 */
export function deterministicProductId(
  sessionId: string,
  nome: string,
  idx: number,
): string {
  const slug = (nome || "produto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `legacy_${sessionId}_${idx}_${slug || "produto"}`;
}

export function buildEtapasPadrao(): EtapaProducao[] {
  return ETAPAS_PADRAO_NOMES.map((nome, i) => ({
    id: slugId("std", nome, i),
    nome,
    done: false,
  }));
}

export function buildEtapasFromNames(nomes: string[]): EtapaProducao[] {
  const clean = nomes.map((n) => (n || "").trim()).filter(Boolean);
  const source = clean.length > 0 ? clean : CUSTOM_FLOW_DEFAULT;
  return source.map((nome, i) => ({
    id: slugId("cst", nome, i),
    nome,
    done: false,
  }));
}

/** Aplica o critério "clique em etapa X marca X e anteriores como done".
 *  Se a etapa clicada já é a última done, desmarca-a (volta o ponteiro).
 */
export function toggleEtapaAt(etapas: EtapaProducao[], index: number): EtapaProducao[] {
  if (index < 0 || index >= etapas.length) return etapas;
  const clicked = etapas[index];
  const nextDoneCount = etapas.filter((e) => e.done).length;
  const isCurrentLastDone = clicked.done && (index === nextDoneCount - 1);
  return etapas.map((e, i) => {
    if (isCurrentLastDone) return { ...e, done: i < index };
    return { ...e, done: i <= index };
  });
}

/** Índice da etapa atual (primeiro !done). Retorna etapas.length se tudo feito. */
export function etapaAtualIndex(etapas: EtapaProducao[]): number {
  const idx = etapas.findIndex((e) => !e.done);
  return idx === -1 ? etapas.length : idx;
}

export function isEntregue(etapas: EtapaProducao[] | undefined | null): boolean {
  if (!etapas || etapas.length === 0) return false;
  return etapas.every((e) => e.done);
}

/** Avança uma etapa: marca o primeiro !done como done. No-op se tudo pronto. */
export function advanceOne(etapas: EtapaProducao[]): EtapaProducao[] {
  const idx = etapas.findIndex((e) => !e.done);
  if (idx === -1) return etapas;
  return etapas.map((e, i) => (i === idx ? { ...e, done: true } : e));
}

/** Retrocede uma etapa: marca a última done como !done. No-op se nada done. */
export function retreatOne(etapas: EtapaProducao[]): EtapaProducao[] {
  let last = -1;
  for (let i = 0; i < etapas.length; i++) if (etapas[i].done) last = i;
  if (last === -1) return etapas;
  return etapas.map((e, i) => (i === last ? { ...e, done: false } : e));
}

/** Hash estável do padrão done/pendente — usado para dedup do eco. */
export function etapasHash(etapas: EtapaProducao[] | undefined | null): string {
  if (!etapas || etapas.length === 0) return "";
  return etapas.map((e) => (e.done ? "1" : "0")).join("");
}

/** Hidrata um item legado (só `produzido`/`entregue`) em um item completo. */
export function hydrateProduto<T extends ProdutoWorkflowFlow>(p: T): T {
  // Normaliza prazoEntrega em qualquer formato ISO para YYYY-MM-DD.
  const prazoNorm =
    typeof p.prazoEntrega === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.prazoEntrega)
      ? p.prazoEntrega.slice(0, 10)
      : undefined;
  if (p.etapas && p.etapas.length > 0) {
    const fluxo: FluxoProducao = p.fluxo ?? "padrao";
    return { ...p, fluxo, prazoEntrega: prazoNorm };
  }
  const etapas = buildEtapasPadrao();
  if (p.entregue) etapas.forEach((e) => (e.done = true));
  else if (p.produzido) {
    // Marca todas exceto a última.
    etapas.forEach((e, i) => (e.done = i < etapas.length - 1));
  }
  return { ...p, fluxo: "padrao", etapas, prazoEntrega: prazoNorm };
}

/** Sincroniza os flags legados a partir das etapas. */
export function syncLegacyFlags<T extends ProdutoWorkflowFlow>(p: T): T {
  const etapas = p.etapas ?? [];
  const entregue = isEntregue(etapas);
  const produzido = etapas.length > 1
    ? etapas.slice(0, -1).every((e) => e.done)
    : entregue;
  return { ...p, produzido, entregue };
}

/** Ao trocar o modo padrão↔custom, preserva progresso por posição. */
export function switchFluxo(
  p: ProdutoWorkflowFlow,
  novoFluxo: FluxoProducao,
  ultimoCustomNomes?: string[],
): ProdutoWorkflowFlow {
  if (novoFluxo === p.fluxo && p.etapas && p.etapas.length > 0) return p;
  const doneCount = (p.etapas ?? []).filter((e) => e.done).length;
  const base =
    novoFluxo === "padrao" ? buildEtapasPadrao() : buildEtapasFromNames(ultimoCustomNomes ?? []);
  const withProgress = base.map((e, i) => ({ ...e, done: i < doneCount }));
  return { ...p, fluxo: novoFluxo, etapas: withProgress };
}
