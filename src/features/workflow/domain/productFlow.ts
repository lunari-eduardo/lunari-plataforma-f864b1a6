/**
 * Domínio: fluxo de produção por produto do Workflow.
 *
 * Modelo (v2 — Nov/2026):
 *  - Cada produto tem um `estado` implícito de produção:
 *      • pending      → nada iniciado ainda ("A produzir")
 *      • in_progress  → alguma etapa concluída, mas ainda não entregue
 *      • done         → todas as etapas concluídas (entregue)
 *  - `started` (persistido) marca o momento em que o fotógrafo declara início
 *    da produção (via CTA "Iniciar produção") mesmo sem marcar etapa alguma.
 *  - `etapas` são passos operacionais **do processo**, NUNCA o gatilho de
 *    início. Por isso a etapa "A produzir" foi removida do fluxo padrão.
 *  - Retro-compat: itens legados com primeira etapa "A produzir" são
 *    migrados no `hydrateProduto` — o done dessa etapa vira `started`.
 */

export type EtapaProducao = {
  id: string;
  nome: string;
  done: boolean;
};

export type FluxoProducao = "padrao" | "custom";
export type ProductionStatus = "pending" | "in_progress" | "done";

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
  /** Flag explícita — true quando o fotógrafo iniciou a produção. */
  started?: boolean;
  /** Timestamp ISO do momento em que `started` virou true. */
  startedAt?: string;
  // Legado — mantido como espelho derivado na escrita.
  produzido?: boolean;
  entregue?: boolean;
}

/**
 * Etapas padrão do fluxo operacional. "A produzir" NÃO faz mais parte —
 * o estado "pending" é derivado de `started === false`.
 */
export const ETAPAS_PADRAO_NOMES = ["Em produção", "Entregue"] as const;
export const CUSTOM_FLOW_DEFAULT = ["Diagramação", "Aprovação", "Laboratório", "Entrega"];

/** Nome legado que precisa ser migrado ao hidratar. */
const LEGACY_FIRST_STAGE_NAMES = new Set([
  "a produzir",
  "aproduzir",
  "produzir",
]);

const isLegacyFirstStage = (nome: string | undefined | null): boolean => {
  if (!nome) return false;
  return LEGACY_FIRST_STAGE_NAMES.has(
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim(),
  );
};

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
  const clean = nomes
    .map((n) => (n || "").trim())
    .filter((n) => n && !isLegacyFirstStage(n));
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

/**
 * Um produto é considerado "iniciado" quando o fotógrafo marcou explicitamente
 * (`started === true`) OU quando existe pelo menos uma etapa concluída.
 */
export function isProdutoStarted(p: Pick<ProdutoWorkflowFlow, "started" | "etapas">): boolean {
  if (p.started) return true;
  return (p.etapas ?? []).some((e) => e.done);
}

/** Retorna o status de produção derivado. */
export function getProductionStatus(
  p: Pick<ProdutoWorkflowFlow, "started" | "etapas">,
): ProductionStatus {
  const etapas = p.etapas ?? [];
  if (etapas.length > 0 && isEntregue(etapas)) return "done";
  if (isProdutoStarted(p)) return "in_progress";
  return "pending";
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

/** Hash estável — inclui flag started para invalidar dedup na transição pending→in_progress. */
export function etapasHash(etapas: EtapaProducao[] | undefined | null): string {
  if (!etapas || etapas.length === 0) return "";
  return etapas.map((e) => (e.done ? "1" : "0")).join("");
}

/** Hidrata um item — aplica migração legada e sincroniza flags. */
export function hydrateProduto<T extends ProdutoWorkflowFlow>(p: T): T {
  // Normaliza prazoEntrega em qualquer formato ISO para YYYY-MM-DD.
  const prazoNorm =
    typeof p.prazoEntrega === "string" && /^\d{4}-\d{2}-\d{2}/.test(p.prazoEntrega)
      ? p.prazoEntrega.slice(0, 10)
      : undefined;

  const fluxo: FluxoProducao = p.fluxo ?? "padrao";

  // Caminho 1 — sem etapas: cria padrão. `started` fica como veio (ou false).
  if (!p.etapas || p.etapas.length === 0) {
    const etapas = buildEtapasPadrao();
    if (p.entregue) etapas.forEach((e) => (e.done = true));
    else if (p.produzido) etapas.forEach((e, i) => (e.done = i < etapas.length - 1));
    const started = !!p.started || etapas.some((e) => e.done);
    return {
      ...p,
      fluxo,
      etapas,
      prazoEntrega: prazoNorm,
      started,
      startedAt: p.startedAt,
    };
  }

  // Caminho 2 — com etapas. Detecta e migra a etapa legada "A produzir".
  let etapas = p.etapas;
  let startedFromLegacy: boolean | undefined;
  if (isLegacyFirstStage(etapas[0]?.nome)) {
    startedFromLegacy = !!etapas[0]?.done;
    etapas = etapas.slice(1);
    if (etapas.length === 0) etapas = buildEtapasPadrao();
  }

  const started =
    !!p.started ||
    (startedFromLegacy ?? false) ||
    etapas.some((e) => e.done);

  return {
    ...p,
    fluxo,
    etapas,
    prazoEntrega: prazoNorm,
    started,
    startedAt: p.startedAt,
  };
}

/** Sincroniza os flags legados a partir das etapas. */
export function syncLegacyFlags<T extends ProdutoWorkflowFlow>(p: T): T {
  const etapas = p.etapas ?? [];
  const entregue = isEntregue(etapas);
  const produzido = etapas.length > 1
    ? etapas.slice(0, -1).every((e) => e.done)
    : entregue;
  const started = !!p.started || etapas.some((e) => e.done);
  const startedAt = started && !p.startedAt ? new Date().toISOString() : p.startedAt;
  return { ...p, produzido, entregue, started, startedAt };
}

/** Marca o produto como iniciado. No-op se já iniciado. */
export function startProduction<T extends ProdutoWorkflowFlow>(p: T): T {
  if (isProdutoStarted(p)) return p;
  return { ...p, started: true, startedAt: p.startedAt ?? new Date().toISOString() };
}

/**
 * Reabre a produção — volta ao estado "pending" (`started=false`, sem etapa done).
 * Preserva a estrutura de etapas e o histórico de startedAt limpo.
 */
export function reopenProduction<T extends ProdutoWorkflowFlow>(p: T): T {
  const etapas = (p.etapas ?? []).map((e) => ({ ...e, done: false }));
  return { ...p, etapas, started: false, startedAt: undefined };
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
