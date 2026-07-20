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
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { useRunCapability } from "@/shared/capability";
import { createTask, updateTask } from "@/modules/tasks";
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
  const { deleteTask: deleteTaskLocal } = useSupabaseTasks();
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
    // produtos que estavam memoizados (write recente do dock/modal). Precisam
    // ser tratados como "vistos" para NÃO serem apagados como órfãos.
    const memoizedBySession = new Map<string, Set<string>>();
    for (const session of sessions) {
      const produtos = normalizeProdutos(session.produtos_incluidos);
      const memoSet = new Set<string>();
      memoizedBySession.set(session.id, memoSet);
      if (produtos.length === 0) {
        specsBySession.set(session.id, []);
        continue;
      }
      const specs: MirrorSpec[] = [];
      for (const p of produtos) {
        const hydrated = hydrateProduto(p);
        const pid = hydrated.id;
        // Anti-eco AMPLIADO: qualquer write recente (mesmo com hash divergente)
        // congela a reconciliação para este produto. O produto no workflowStore
        // pode estar stale (persist ainda em vôo); construir spec a partir dele
        // recriaria/reverteria a tarefa para a etapa antiga.
        //
        // Enquanto a memo estiver ativa, o handler otimista (dock/modal) é a
        // fonte visual; quando o store convergir e a memo expirar, o próximo
        // tick reconcilia normalmente.
        if (pid && mirrorMemoStore.hasRecent(session.id, pid)) {
          memoSet.add(pid);
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
      const memoizedProductIds = memoizedBySession.get(sessionId) ?? new Set<string>();

      for (const spec of specs) {
        seenProductIds.add(spec.produtoId);
        const existing = findMirrorTask(tasks, sessionId, spec.produtoId);
        await applySpec(spec, existing);
      }

      // Órfãs: tarefas cujo produtoId não existe mais → apagar.
      // NUNCA apagar produtos memoizados (write recente em janela anti-eco).
      for (const t of sessionMirrors) {
        const pid = extractProdutoIdFromTask(t);
        if (!pid || seenProductIds.has(pid) || memoizedProductIds.has(pid)) continue;
        // Trava extra: se houve write recente para essa task, não apagar.
        const lastWrite = lastWriteByTaskRef.current.get(t.id);
        if (lastWrite && Date.now() - lastWrite.at < 1500) continue;
        await removeTask(t);
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

      // Caso 2: existe. Produto entregue → APAGAR tarefa (sem histórico).
      if (spec.isEntregue) {
        await removeTask(existing);
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

    async function removeTask(task: Task) {
      const inflightKey = `del:${task.id}`;
      if (taskWriteInFlightRef.current.has(inflightKey)) return;
      taskWriteInFlightRef.current.add(inflightKey);
      try {
        await deleteTaskLocal(task.id);
        lastWriteByTaskRef.current.set(task.id, {
          sig: `DEL::${task.id}`,
          at: Date.now(),
        });
      } catch (e) {
        console.warn("[productTaskMirror] falha ao excluir tarefa", e);
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

// =====================================================================
// Toggle handler Tarefa → Produto (reintrodução bidirecional controlada).
// =====================================================================
export interface MirrorToggleDeps {
  /** Persistência de `produtosList` no cache/DB (ex.: `actions.handleFieldUpdate`). */
  updateSessionProducts: (
    sessionId: string,
    novosProdutos: ProdutoWorkflowFlow[],
  ) => Promise<unknown> | unknown;
  /** Atualização otimista da tarefa no store local. */
  updateTaskLocal: (taskId: string, patch: Partial<Task>) => Promise<unknown> | unknown;
  /** Remoção otimista da tarefa no store local (usada quando produto entrega). */
  removeTaskLocal: (taskId: string) => Promise<unknown> | unknown;
}

export function useMirrorToggleHandler(deps: MirrorToggleDeps) {
  const { getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
  const depsRef = useRef(deps);
  depsRef.current = deps;

  return useCallback(
    async (task: Task, nextIsDone: boolean) => {
      const produtoId = extractProdutoIdFromTask(task);
      if (!produtoId || !task.relatedSessionId) return;
      const session = workflowStore.getById(task.relatedSessionId);
      if (!session) return;
      const produtos = normalizeProdutos(session.produtos_incluidos).map(hydrateProduto);
      const idx = findProdutoIndexInSession(produtos, produtoId);
      if (idx === -1) return;

      const produto = produtos[idx];
      const etapas = produto.etapas ?? [];
      const novasEtapas = nextIsDone ? advanceOne(etapas) : retreatOne(etapas);
      if (novasEtapas === etapas) return; // no-op

      const entregue = isEntregue(novasEtapas);
      const proxIdx = etapaAtualIndex(novasEtapas);
      const proxNome = entregue ? null : novasEtapas[proxIdx]?.nome ?? null;
      const novoProduto: ProdutoWorkflowFlow = {
        ...produto,
        etapas: novasEtapas,
        entregue,
        produzido:
          novasEtapas.length > 1
            ? novasEtapas.slice(0, -1).every((e) => e.done)
            : entregue,
      };
      const novaLista = produtos.map((p, i) => (i === idx ? novoProduto : p));

      // Memoriza o hash — evita eco na próxima passada do reconciliador.
      mirrorMemoStore.memorize(session.id, produtoId, etapasHash(novasEtapas));

      // Título esperado para a tarefa (mesma regra do buildMirrorSpec).
      const clienteNome = (session as any).clientes?.nome ?? "";
      const novoTitulo = buildTitle({
        produtoNome: produto.nome,
        quantidade: Number(produto.quantidade) || 1,
        clienteNome,
        etapaAtualNome: proxNome,
        isEntregue: entregue,
      });

      // Otimismo: aplica na UI da tarefa imediatamente.
      try {
        if (entregue) {
          await depsRef.current.removeTaskLocal(task.id);
        } else {
          await depsRef.current.updateTaskLocal(task.id, {
            title: novoTitulo,
            status: getDefaultOpenKey(),
          } as Partial<Task>);
        }
      } catch (e) {
        console.warn("[useMirrorToggleHandler] falha ao aplicar tarefa otimista", e);
      }

      // Persiste no produto — em caso de erro, reverte a tarefa e limpa memo.
      try {
        await depsRef.current.updateSessionProducts(session.id, novaLista);
      } catch (e) {
        console.warn("[useMirrorToggleHandler] falha ao gravar produto — revertendo tarefa", e);
        mirrorMemoStore.clear(session.id);
        try {
          await depsRef.current.updateTaskLocal(task.id, {
            title: task.title,
            status: task.status,
          } as Partial<Task>);
        } catch {
          /* noop */
        }
      }
    },
    [getDoneKey, getDefaultOpenKey],
  );
}

