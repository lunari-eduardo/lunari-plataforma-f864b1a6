/**
 * Espelho Produto ↔ Tarefa (uma tarefa operacional por produto do Workflow).
 *
 * Regras:
 *  - Um produto em produção gera EXATAMENTE UMA tarefa (tag `produto:<id>`).
 *  - O título reflete a primeira etapa pendente: "<Etapa> — <Produto> · <Cliente>".
 *  - Quando `isEntregue`, a tarefa vai para status terminal (histórico).
 *  - A tarefa é identificada por `related_session_id` + tag `produto:<produtoId>`.
 */

import type { Task } from "@/types/tasks";
import type { WorkflowSession } from "../domain/session";
import {
  hydrateProduto,
  etapaAtualIndex,
  isEntregue,
  type ProdutoWorkflowFlow,
} from "./productFlow";

export const MIRROR_ROOT_TAG = "workflow:produto";
export const productTagFor = (produtoId: string) => `produto:${produtoId}`;

export interface MirrorSpec {
  produtoId: string;
  sessionId: string;
  clienteId?: string;
  clienteNome: string;
  produtoNome: string;
  quantidade: number;
  etapaAtualNome: string | null; // null => produto entregue
  isEntregue: boolean;
  tags: string[];
  title: string;
}

export function buildTitle(spec: {
  produtoNome: string;
  quantidade: number;
  clienteNome: string;
  etapaAtualNome: string | null;
  isEntregue: boolean;
}): string {
  const nomeProduto =
    spec.quantidade > 1 ? `${spec.produtoNome} (x${spec.quantidade})` : spec.produtoNome;
  const acao = spec.isEntregue || !spec.etapaAtualNome ? "Concluído" : spec.etapaAtualNome;
  const cliente = spec.clienteNome?.trim() || "Cliente";
  return `${acao} — ${nomeProduto} · ${cliente}`;
}

export function buildMirrorSpec(
  session: Pick<WorkflowSession, "id" | "cliente_id" | "clientes">,
  produtoRaw: ProdutoWorkflowFlow,
): MirrorSpec | null {
  if (!produtoRaw?.id) return null;
  const produto = hydrateProduto(produtoRaw);
  const etapas = produto.etapas ?? [];
  const entregue = isEntregue(etapas);
  const idx = etapaAtualIndex(etapas);
  const etapaAtualNome = entregue ? null : etapas[idx]?.nome ?? null;
  const clienteNome = session.clientes?.nome ?? "";
  const quantidade = Number(produto.quantidade) || 1;
  const title = buildTitle({
    produtoNome: produto.nome,
    quantidade,
    clienteNome,
    etapaAtualNome,
    isEntregue: entregue,
  });
  return {
    produtoId: produto.id,
    sessionId: session.id,
    clienteId: session.cliente_id,
    clienteNome,
    produtoNome: produto.nome,
    quantidade,
    etapaAtualNome,
    isEntregue: entregue,
    tags: [MIRROR_ROOT_TAG, productTagFor(produto.id)],
    title,
  };
}

/** Retorna a tarefa-espelho para (sessionId, produtoId), ou undefined. */
export function findMirrorTask(
  tasks: Task[],
  sessionId: string,
  produtoId: string,
): Task | undefined {
  const tag = productTagFor(produtoId);
  return tasks.find(
    (t) =>
      t.relatedSessionId === sessionId &&
      Array.isArray(t.tags) &&
      t.tags.includes(tag),
  );
}

/** Todas as tarefas-espelho de uma sessão (ativas ou concluídas). */
export function listMirrorTasksForSession(tasks: Task[], sessionId: string): Task[] {
  return tasks.filter(
    (t) =>
      t.relatedSessionId === sessionId &&
      Array.isArray(t.tags) &&
      t.tags.includes(MIRROR_ROOT_TAG),
  );
}

/** Extrai o `produtoId` de uma tarefa-espelho (ou null se não for). */
export function extractProdutoIdFromTask(task: Task): string | null {
  if (!task.tags || !task.tags.includes(MIRROR_ROOT_TAG)) return null;
  const tag = task.tags.find((t) => t.startsWith("produto:"));
  return tag ? tag.slice("produto:".length) : null;
}

/** Assinatura estável (title+isDone) — usada para dedup de escrita/eco. */
export function taskSignature(title: string, isDone: boolean): string {
  return `${isDone ? "D" : "O"}::${title}`;
}
