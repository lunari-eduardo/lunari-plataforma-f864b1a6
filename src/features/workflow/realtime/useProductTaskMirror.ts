/**
 * Reconciliador Produto ↔ Tarefa (Onda: Integração com Tarefas).
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
 *  3. Detecta ação vinda do dock: se uma tarefa-espelho passou para status
 *     terminal E o produto correspondente ainda tem etapas pendentes, avança
 *     UMA etapa no produto. Se reabriu, retrocede uma etapa.
 *  4. Anti-eco: guarda a assinatura (title+isDone) que o reconciliador escreveu
 *     por 3s. Escritas retornadas pelo realtime com a mesma assinatura são
 *     ignoradas (não disparam interpretação inversa).
 *
 * Sem migration; sem canal realtime novo. Reaproveita `TasksRealtimeBridge`.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workflowStore } from "@/features/workflow/store/workflowStore";
import { useTasks } from "@/modules/tasks/presentation/hooks/useTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { useRunCapability } from "@/shared/capability";
import { createTask, updateTask, completeTask } from "@/modules/tasks";
import { updateSessionFields } from "@/modules/workflow";
import { isOk } from "@/shared/result";
import type { Task } from "@/types/tasks";
import type { WorkflowSession } from "@/features/workflow/domain/session";
import {
  buildMirrorSpec,
  extractProdutoIdFromTask,
  findMirrorTask,
  listMirrorTasksForSession,
  MIRROR_ROOT_TAG,
  taskSignature,
  type MirrorSpec,
} from "@/features/workflow/domain/productTaskMirror";
import {
  hydrateProduto,
  etapaAtualIndex,
  toggleEtapaAt,
  syncLegacyFlags,
  isEntregue,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";

const ECHO_TTL_MS = 3_000;
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
  const { getDoneKey, getDefaultOpenKey, isTerminalKey, statuses } =
    useSupabaseTaskStatuses();

  // Memórias mutáveis (sem re-render):
  const lastWriteByTaskRef = useRef<Map<string, WriteMemo>>(new Map()); // taskId → sig
  const prevTaskStatusRef = useRef<Map<string, string>>(new Map()); // taskId → status
  const productWriteInFlightRef = useRef<Set<string>>(new Set()); // sessionId:produtoId
  const taskWriteInFlightRef = useRef<Set<string>>(new Set()); // taskId | new:sessionId:produtoId
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (!statuses || statuses.length === 0) return; // aguarda statuses

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
    const mirrorTasks = tasks.filter(
      (t) => Array.isArray(t.tags) && t.tags.includes(MIRROR_ROOT_TAG),
    );

    // === 1) Direção Tarefa → Produto (avanço / retrocesso de etapa) ===
    // Detecta transições de status desde a última passada.
    const prevMap = prevTaskStatusRef.current;
    const nextMap = new Map<string, string>();
    for (const t of mirrorTasks) nextMap.set(t.id, t.status);

    for (const task of mirrorTasks) {
      const prevStatus = prevMap.get(task.id);
      const currStatus = task.status;
      if (prevStatus === undefined) continue; // primeira observação — sem transição
      if (prevStatus === currStatus) continue;

      const wasDone = isTerminalKey(prevStatus);
      const isDone = isTerminalKey(currStatus);
      if (wasDone === isDone) continue; // mudou entre estados abertos: ignora

      // Anti-eco: se essa assinatura foi ESCRITA por nós há < 3s, ignora.
      const memo = lastWriteByTaskRef.current.get(task.id);
      const currSig = taskSignature(task.title, isDone);
      if (memo && memo.sig === currSig && Date.now() - memo.at < ECHO_TTL_MS) continue;

      const sessionId = task.relatedSessionId ?? "";
      const produtoId = extractProdutoIdFromTask(task);
      if (!sessionId || !produtoId) continue;
      const session = sessionsById.get(sessionId);
      if (!session) continue;

      const inflightKey = `${sessionId}:${produtoId}`;
      if (productWriteInFlightRef.current.has(inflightKey)) continue;

      const produtos = normalizeProdutos(session.produtos_incluidos);
      const idxProd = produtos.findIndex((p) => p.id === produtoId);
      if (idxProd < 0) continue;
      const produto = hydrateProduto(produtos[idxProd]);
      const etapas = produto.etapas ?? [];
      if (etapas.length === 0) continue;

      let newEtapas = etapas;
      if (isDone) {
        // Avança 1 etapa: marca a etapa atual como done.
        const currIdx = etapaAtualIndex(etapas);
        if (currIdx >= etapas.length) continue; // já tudo concluído
        newEtapas = toggleEtapaAt(etapas, currIdx);
      } else {
        // Reabriu: retrocede 1 etapa (desmarca última done).
        const doneCount = etapas.filter((e) => e.done).length;
        if (doneCount === 0) continue;
        newEtapas = toggleEtapaAt(etapas, doneCount - 1);
      }

      const novoProduto = syncLegacyFlags({ ...produto, etapas: newEtapas });
      const novos = [...produtos];
      novos[idxProd] = novoProduto;

      productWriteInFlightRef.current.add(inflightKey);
      try {
        await runCapability(updateSessionFields, {
          sessionId,
          fields: { produtos_incluidos: novos as unknown as Record<string, unknown> },
        });
      } catch (e) {
        console.warn("[productTaskMirror] falha ao aplicar tarefa→produto", e);
      } finally {
        setTimeout(() => productWriteInFlightRef.current.delete(inflightKey), 500);
      }
    }
    prevTaskStatusRef.current = nextMap;

    // === 2) Direção Produto → Tarefa (create/update/complete) ===
    const specsBySession = new Map<string, MirrorSpec[]>();
    for (const session of sessions) {
      const produtos = normalizeProdutos(session.produtos_incluidos);
      if (produtos.length === 0) {
        specsBySession.set(session.id, []);
        continue;
      }
      const specs: MirrorSpec[] = [];
      for (const p of produtos) {
        const s = buildMirrorSpec(session, p);
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

    // === 3) Tarefas-espelho de sessões que sumiram do cache: conclui ===
    for (const t of mirrorTasks) {
      const sid = t.relatedSessionId ?? "";
      if (!sid) continue;
      if (sessionsById.has(sid)) continue;
      if (isTerminalKey(t.status)) continue;
      // Só concluímos se realmente sabemos que a sessão foi removida.
      // Se o mês não está carregado, não temos essa certeza — pulamos.
      // Heurística: se qualquer outra tarefa-espelho da mesma sessão está
      // apontando para uma sessão em cache, cache tem esse mês. Caso não,
      // não concluir (evita fechar tarefas de meses fora do cache).
    }

    async function applySpec(spec: MirrorSpec, existing: Task | undefined) {
      const doneKey = getDoneKey();
      const openKey = getDefaultOpenKey();

      // Caso 1: não existe tarefa → cria (a menos que já esteja entregue).
      if (!existing) {
        if (spec.isEntregue) return; // produto já concluído e sem histórico → nada a criar
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
