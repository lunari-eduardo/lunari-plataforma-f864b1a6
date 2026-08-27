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
import { sessionsRepo } from "@/features/workflow/data/sessionsRepo";
import { useTasks } from "@/modules/tasks/presentation/hooks/useTasks";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { useRunCapability } from "@/shared/capability";
import { createTask, updateTask } from "@/modules/tasks";
import { tasksStore } from "@/modules/tasks/presentation/store/tasksStore";
import { supabase } from "@/integrations/supabase/client";
import { isOk } from "@/shared/result";
import type { Task } from "@/types/tasks";
import type { WorkflowSession } from "@/features/workflow/domain/session";
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
  deterministicProductId,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";
import { mirrorMemoStore } from "@/features/workflow/realtime/mirrorMemoStore";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveSessionForMirrorToggle(
  sessionRef: string,
  userId?: string,
): Promise<WorkflowSession | null> {
  const fromStore =
    workflowStore.getById(sessionRef) ?? workflowStore.getBySessionId(sessionRef);
  if (fromStore) return fromStore;
  if (!userId) return null;

  const tryFetch = async (mode: "id" | "sessionId") => {
    try {
      return mode === "id"
        ? await sessionsRepo.getById(userId, sessionRef)
        : await sessionsRepo.getBySessionId(userId, sessionRef);
    } catch (e) {
      console.warn("[useMirrorToggleHandler] fallback DB falhou", { mode, e });
      return null;
    }
  };

  const preferred = UUID_RE.test(sessionRef) ? "id" : "sessionId";
  const alt = preferred === "id" ? "sessionId" : "id";
  const fresh = (await tryFetch(preferred)) ?? (await tryFetch(alt));
  if (fresh) {
    try {
      workflowStore.upsert(fresh as WorkflowSession);
    } catch {
      /* noop */
    }
    return fresh as WorkflowSession;
  }
  return null;
}

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
  }, [user?.id, version, statuses]);

  async function reconcile() {
    const currentTasks = tasksStore.getAll();
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
      for (let i = 0; i < produtos.length; i++) {
        const hydrated = hydrateProduto(produtos[i]);
        // Rede de segurança: produtos legados (venda avulsa antiga, importações)
        // podem não ter `id` persistido. Gera id determinístico em runtime — a
        // dedup do espelho depende disso e sem id `buildMirrorSpec` retorna null.
        if (!hydrated.id) {
          hydrated.id = deterministicProductId(session.id, hydrated.nome, i);
        }
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
      const sessionMirrors = listMirrorTasksForSession(currentTasks, sessionId);
      const seenProductIds = new Set<string>();
      const memoizedProductIds = memoizedBySession.get(sessionId) ?? new Set<string>();

      for (const spec of specs) {
        seenProductIds.add(spec.produtoId);
        const existing = findMirrorTask(currentTasks, sessionId, spec.produtoId);
        await applySpec(spec, existing);
      }

      // Órfãs: tarefas cujo produtoId não existe mais → apagar.
      // NUNCA apagar produtos memoizados (write recente em janela anti-eco).
      for (const t of sessionMirrors) {
        const pid = extractProdutoIdFromTask(t);
        if (!pid || seenProductIds.has(pid) || memoizedProductIds.has(pid)) continue;

        // Checagem defensiva adicional: não apagar se o produto ainda existe na sessão com outro formato de id
        const produtosAtuais = normalizeProdutos(session.produtos_incluidos);
        const existeCorrespondente = produtosAtuais.some((p, i) => {
          const detId = deterministicProductId(session.id, p?.nome || "produto", i);
          return p?.id === pid || detId === pid;
        });
        if (existeCorrespondente) continue;

        // Trava extra: se houve write recente para essa task, não apagar.
        const lastWrite = lastWriteByTaskRef.current.get(t.id);
        if (lastWrite && Date.now() - lastWrite.at < 3000) continue;
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
          // Usa RPC idempotente: `upsert_product_mirror_task` tem UNIQUE
          // (related_session_id, mirror_product_tag) e ON CONFLICT no banco.
          // Isso torna corridas entre abas/reconnects impossíveis de gerar
          // linhas duplicadas — barreira definitiva vs. `createTask` cego.
          const produtoTag = `produto:${spec.produtoId}`;
          const payload = {
            title: spec.title,
            status: openKey,
            priority: "media",
            type: "workflow_produto",
            source: "workflow",
            tags: spec.tags,
            related_cliente_id: spec.clienteId ?? null,
          };
          const { data, error } = await supabase.rpc(
            "upsert_product_mirror_task" as never,
            {
              p_session_id: spec.sessionId,
              p_product_tag: produtoTag,
              p_payload: payload,
            } as never,
          );
          if (error) throw error;
          let row: { id?: string } | null = null;
          if (data != null) {
            const arr = data as unknown;
            if (Array.isArray(arr)) row = (arr[0] as { id?: string } | undefined) ?? null;
            else row = arr as { id?: string };
          }
          if (row?.id) {
            lastWriteByTaskRef.current.set(row.id as string, {
              sig: taskSignature(spec.title, false),
              at: Date.now(),
            });
            // Otimismo local: injeta a tarefa recém-criada no tasksStore para
            // que o dock reflita imediatamente sem depender do round-trip do
            // realtime (que pode demorar segundos ou perder o evento). O
            // próximo evento realtime sobrescreve com a versão canônica.
            try {
              const nowIso = new Date().toISOString();
              tasksStore.upsert({
                id: row.id as string,
                title: spec.title,
                status: openKey,
                priority: "medium",
                type: "workflow_produto" as any,
                source: "automation",
                tags: spec.tags,
                relatedClienteId: spec.clienteId,
                relatedSessionId: spec.sessionId,
                createdAt: nowIso,
                updatedAt: nowIso,
              } as Task);
            } catch (e) {
              console.warn("[productTaskMirror] otimismo local falhou", e);
            }
          }
        } catch (e) {
          console.warn("[productTaskMirror] falha ao upsert tarefa-espelho", e);
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

      // Otimismo local IMEDIATO — dock/kanban refletem a nova etapa sem
      // esperar o round-trip da capability nem o eco Realtime.
      const optimisticPatch: Partial<Task> = {};
      if (titleChanged) optimisticPatch.title = spec.title;
      if (shouldReopen) optimisticPatch.status = openKey;
      const snapshot = tasksStore.applyOptimisticPatch(existing.id, optimisticPatch);

      try {
        const patch: Record<string, unknown> = { ...optimisticPatch };
        const res = await runCapability(updateTask, {
          id: existing.id,
          patch: patch as never,
        });
        if (isOk(res)) {
          lastWriteByTaskRef.current.set(existing.id, {
            sig: taskSignature(spec.title, false),
            at: Date.now(),
          });
        } else if (snapshot) {
          // Reverte otimismo em caso de falha da capability.
          try { tasksStore.revertTo(snapshot); } catch { /* noop */ }
        }
      } catch (e) {
        console.warn("[productTaskMirror] falha ao atualizar tarefa", e);
        if (snapshot) {
          try { tasksStore.revertTo(snapshot); } catch { /* noop */ }
        }
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
  const { user } = useAuth();
  const { getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
  const depsRef = useRef(deps);
  depsRef.current = deps;

  return useCallback(
    async (task: Task, nextIsDone: boolean) => {
      const produtoId = extractProdutoIdFromTask(task);
      if (!produtoId || !task.relatedSessionId) return;
      const session = await resolveSessionForMirrorToggle(task.relatedSessionId, user?.id);
      if (!session) {
        console.warn("[useMirrorToggleHandler] sessão não encontrada para tarefa-espelho", {
          taskId: task.id,
          relatedSessionId: task.relatedSessionId,
        });
        return;
      }
      // Normaliza produtos com o mesmo fallback do reconciliador (id determinístico
      // para produtos legados/venda avulsa sem id persistido).
      const produtos = normalizeProdutos(session.produtos_incluidos).map((p, i) => {
        const hydrated = hydrateProduto(p);
        if (hydrated.id) return hydrated;
        return {
          ...hydrated,
          id: deterministicProductId(session.id, hydrated.nome, i),
        };
      });
      const idx = findProdutoIndexInSession(produtos, produtoId);
      if (idx === -1) {
        console.warn("[useMirrorToggleHandler] produto da tarefa-espelho não encontrado", {
          taskId: task.id,
          sessionId: session.id,
          produtoId,
        });
        return;
      }

      const produto = produtos[idx];
      const etapas = produto.etapas ?? [];
      const novasEtapas = nextIsDone ? advanceOne(etapas) : retreatOne(etapas);
      if (novasEtapas === etapas) return; // no-op

      const entregue = isEntregue(novasEtapas);
      const anyDone = novasEtapas.some((e) => e.done);
      const startedFlag = !!(produto as any).started || anyDone;
      const proxIdx = etapaAtualIndex(novasEtapas);
      const proxNome = entregue ? null : novasEtapas[proxIdx]?.nome ?? null;
      const novoProduto: ProdutoWorkflowFlow = {
        ...produto,
        etapas: novasEtapas,
        started: startedFlag,
        startedAt:
          startedFlag && !(produto as any).startedAt
            ? new Date().toISOString()
            : (produto as any).startedAt,
        entregue,
        produzido:
          novasEtapas.length > 1
            ? novasEtapas.slice(0, -1).every((e) => e.done)
            : entregue,
      };
      const novaLista = produtos.map((p, i) => (i === idx ? novoProduto : p));

      // Otimismo no workflowStore: reconciliador (Produto → Tarefa) lê daqui.
      try {
        workflowStore.upsert({
          ...(session as WorkflowSession),
          produtos_incluidos: novaLista as any,
          updated_at: new Date().toISOString(),
        } as WorkflowSession);
      } catch (e) {
        console.warn("[useMirrorToggleHandler] falha no upsert otimista do store", e);
      }

      // Título esperado (mesma regra do buildMirrorSpec).
      const clienteNome = (session as any).clientes?.nome ?? "";
      const novoTitulo = buildTitle({
        produtoNome: produto.nome,
        quantidade: Number(produto.quantidade) || 1,
        clienteNome,
        etapaAtualNome: proxNome,
        isPending: !startedFlag && !entregue,
        isEntregue: entregue,
      });

      // Memoriza hash + título esperado — evita eco na próxima passada do reconciliador.
      mirrorMemoStore.memorize(session.id, produtoId, etapasHash(novasEtapas), novoTitulo);

      // Otimismo visual da tarefa via store local (sem round-trip). A escrita
      // canônica no banco acontece depois que o produto for salvo.
      try {
        if (entregue) {
          tasksStore.remove(task.id);
        } else {
          tasksStore.applyOptimisticPatch(task.id, {
            title: novoTitulo,
            status: getDefaultOpenKey(),
          } as any);
        }
      } catch (e) {
        console.warn("[useMirrorToggleHandler] falha ao aplicar tarefa otimista", e);
      }

      // Product-first: salva o produto e SÓ ENTÃO ajusta/apaga a tarefa no banco.
      try {
        await depsRef.current.updateSessionProducts(session.id, novaLista);
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
          console.warn(
            "[useMirrorToggleHandler] produto salvo, mas persistência da task falhou",
            e,
          );
        }
      } catch (e) {
        console.warn("[useMirrorToggleHandler] falha ao gravar produto — revertendo", e);
        mirrorMemoStore.clear(session.id, produtoId);
        try {
          if (entregue) {
            tasksStore.upsert(task as any);
          } else {
            tasksStore.applyOptimisticPatch(task.id, {
              title: task.title,
              status: task.status,
            } as any);
          }
        } catch {
          /* noop */
        }
      }
    },
    [getDoneKey, getDefaultOpenKey, user?.id],
  );
}

