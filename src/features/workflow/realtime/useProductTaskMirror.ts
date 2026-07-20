/**
 * Espelho UNIDIRECIONAL Produto → Tarefa (Onda: Integração com Tarefas).
 *
 * Estratégia:
 *  1. Assina `workflowStore` + `useTasks()` + `taskStatusesStore`.
 *  2. Em cada tick, para cada sessão em cache computa a lista esperada de
 *     tarefas-espelho (uma por produto). Compara com o que existe em `tasks`
 *     filtrado pela tag `workflow:produto`:
 *       - falta → cria (title = "<etapa> — <produto> · <cliente>")
 *       - existe com título/status divergente → atualiza
 *       - produto entregue → conclui (mantém histórico no dock)
 *       - tarefa órfã (produtoId sumiu) → conclui
 *
 * NOTA: A direção reversa (Tarefa → Produto) foi REMOVIDA. Etapas do produto
 * só podem ser alteradas pelo modal "Gerenciar produtos" do card do Workflow.
 * Marcar/desmarcar a tarefa-espelho no dock NÃO avança/retrocede etapas.
 *
 * Sem migration; sem canal realtime novo. Reaproveita `TasksRealtimeBridge`.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workflowStore } from "@/features/workflow/store/workflowStore";
import { useTasks } from "@/modules/tasks/presentation/hooks/useTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { useRunCapability } from "@/shared/capability";
import { createTask, updateTask, completeTask } from "@/modules/tasks";
import { isOk } from "@/shared/result";
import type { Task } from "@/types/tasks";
import {
  buildMirrorSpec,
  buildTitle,
  extractProdutoIdFromTask,
  findMirrorTask,
  findProdutoIndexInSession,
  listMirrorTasksForSession,
  MIRROR_ROOT_TAG,
  taskSignature,
  type MirrorSpec,
} from "@/features/workflow/domain/productTaskMirror";
import {
  advanceOne,
  etapasHash,
  hydrateProduto,
  retreatOne,
  isEntregue,
  etapaAtualIndex,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";
import { mirrorMemoStore } from "@/features/workflow/realtime/mirrorMemoStore";

const DEBOUNCE_MS = 180;

type WriteMemo = { sig: string; at: number };

function useWorkflowVersion(): number {
  return useSyncExternalStore(
    workflowStore.subscribe,
    workflowStore.getSnapshotVersion,
    workflowStore.getSnapshotVersion,
  );
}

export function useProductTaskMirror(): void {
  const { user } = useAuth();
  const runCapability = useRunCapability();
  const tasks = useTasks();
  const version = useWorkflowVersion();
  const { getDefaultOpenKey, isTerminalKey, statuses } = useSupabaseTaskStatuses();

  // Memórias mutáveis (sem re-render):
  const lastWriteByTaskRef = useRef<Map<string, WriteMemo>>(new Map());
  const taskWriteInFlightRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (!statuses || statuses.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void reconcile();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tasks, version, statuses]);

  async function reconcile() {
    const sessions = workflowStore.getAll();
    const sessionsById = new Map(sessions.map((s) => [s.id, s]));

    // === Direção ÚNICA: Produto → Tarefa (create/update/complete) ===
    const specsBySession = new Map<string, MirrorSpec[]>();
    for (const session of sessions) {
      const produtos = normalizeProdutos(session.produtos_incluidos);
      if (produtos.length === 0) {
        specsBySession.set(session.id, []);
        continue;
      }
      const specs: MirrorSpec[] = [];
      for (const p of produtos) {
        const hydrated = hydrateProduto(p);
        const pid = hydrated.id;
        // Anti-eco: se esta sessão+produto+hash acabou de ser gravada pelo
        // toggle do dock, pular reconciliação (a tarefa já foi atualizada
        // otimisticamente pelo próprio handler).
        if (pid && mirrorMemoStore.matches(session.id, pid, etapasHash(hydrated.etapas ?? []))) {
          continue;
        }
        const s = buildMirrorSpec(session, hydrated);
        if (s) specs.push(s);
      }
      specsBySession.set(session.id, specs);
    }

    for (const [sessionId, specs] of specsBySession) {
      const session = sessionsById.get(sessionId);
      if (!session) continue;
      const sessionMirrors = listMirrorTasksForSession(tasks, sessionId);
      const seenProductIds = new Set<string>();

      for (const spec of specs) {
        seenProductIds.add(spec.produtoId);
        const existing = findMirrorTask(tasks, sessionId, spec.produtoId);
        await applySpec(spec, existing);
      }

      // Órfãs: tarefas cujo produtoId não existe mais → conclui.
      for (const t of sessionMirrors) {
        const pid = extractProdutoIdFromTask(t);
        if (!pid || seenProductIds.has(pid)) continue;
        if (isTerminalKey(t.status)) continue;
        await concludeTask(t);
      }
    }

    async function applySpec(spec: MirrorSpec, existing: Task | undefined) {
      const openKey = getDefaultOpenKey();

      // Caso 1: não existe tarefa → cria (a menos que já esteja entregue).
      if (!existing) {
        if (spec.isEntregue) return;
        const inflightKey = `new:${spec.sessionId}:${spec.produtoId}`;
        if (taskWriteInFlightRef.current.has(inflightKey)) return;
        taskWriteInFlightRef.current.add(inflightKey);
        try {
          const res = await runCapability(createTask, {
            title: spec.title,
            status: openKey,
            priority: "medium",
            type: "simple",
            source: "automation",
            tags: spec.tags,
            relatedSessionId: spec.sessionId,
            relatedClienteId: spec.clienteId,
          });
          if (isOk(res)) {
            lastWriteByTaskRef.current.set(res.value.id, {
              sig: taskSignature(spec.title, false),
              at: Date.now(),
            });
          }
        } catch (e) {
          console.warn("[productTaskMirror] falha ao criar tarefa", e);
        } finally {
          setTimeout(() => taskWriteInFlightRef.current.delete(inflightKey), 500);
        }
        return;
      }

      // Caso 2: existe. Produto entregue → concluir (uma vez).
      if (spec.isEntregue) {
        if (isTerminalKey(existing.status)) return;
        await concludeTask(existing, spec.title);
        return;
      }

      // Caso 3: existe e produto ainda tem etapa pendente.
      const shouldReopen = isTerminalKey(existing.status);
      const titleChanged = existing.title !== spec.title;
      if (!shouldReopen && !titleChanged) return;

      const inflightKey = existing.id;
      if (taskWriteInFlightRef.current.has(inflightKey)) return;
      taskWriteInFlightRef.current.add(inflightKey);
      try {
        const patch: Record<string, unknown> = {};
        if (titleChanged) patch.title = spec.title;
        if (shouldReopen) patch.status = openKey;
        const res = await runCapability(updateTask, {
          id: existing.id,
          patch: patch as never,
        });
        if (isOk(res)) {
          lastWriteByTaskRef.current.set(existing.id, {
            sig: taskSignature(spec.title, false),
            at: Date.now(),
          });
        }
      } catch (e) {
        console.warn("[productTaskMirror] falha ao atualizar tarefa", e);
      } finally {
        setTimeout(() => taskWriteInFlightRef.current.delete(inflightKey), 500);
      }
    }

    async function concludeTask(task: Task, forcedTitle?: string) {
      const inflightKey = task.id;
      if (taskWriteInFlightRef.current.has(inflightKey)) return;
      taskWriteInFlightRef.current.add(inflightKey);
      try {
        if (forcedTitle && forcedTitle !== task.title) {
          await runCapability(updateTask, {
            id: task.id,
            patch: { title: forcedTitle } as never,
          });
        }
        const res = await runCapability(completeTask, { id: task.id });
        if (isOk(res)) {
          lastWriteByTaskRef.current.set(task.id, {
            sig: taskSignature(forcedTitle ?? task.title, true),
            at: Date.now(),
          });
        }
      } catch (e) {
        console.warn("[productTaskMirror] falha ao concluir tarefa", e);
      } finally {
        setTimeout(() => taskWriteInFlightRef.current.delete(inflightKey), 500);
      }
    }
  }
}

function normalizeProdutos(raw: unknown): ProdutoWorkflowFlow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is ProdutoWorkflowFlow => !!p && typeof p === "object")
    .map((p) => p as ProdutoWorkflowFlow);
}
