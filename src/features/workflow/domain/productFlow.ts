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

/** Hidrata um item legado (só `produzido`/`entregue`) em um item completo. */
export function hydrateProduto<T extends ProdutoWorkflowFlow>(p: T): T {
  if (p.etapas && p.etapas.length > 0) {
    const fluxo: FluxoProducao = p.fluxo ?? "padrao";
    return { ...p, fluxo };
  }
  const etapas = buildEtapasPadrao();
  if (p.entregue) etapas.forEach((e) => (e.done = true));
  else if (p.produzido) {
    // Marca todas exceto a última.
    etapas.forEach((e, i) => (e.done = i < etapas.length - 1));
  }
  return { ...p, fluxo: "padrao", etapas };
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
