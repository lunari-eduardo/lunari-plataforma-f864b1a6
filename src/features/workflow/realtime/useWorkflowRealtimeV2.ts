/**
 * Onda 3 — Realtime unificado (v2).
 *
 * 1 canal único `workflow:user:{userId}` ouvindo `clientes_sessoes` e
 * `clientes_transacoes` filtrados por `user_id`. Fan-out alimenta o
 * `workflowStore` (que já tem anti-eco via `lastSeq`) e dispara o
 * `CustomEvent('workflow-session-updated')` para compat com listeners
 * legados (Workflow.tsx, hooks de métricas) até as Ondas seguintes.
 *
 * Ativação: flag `VITE_WORKFLOW_REALTIME_V2 === 'true'`. Fora isso,
 * o canal legado em `WorkflowCacheContext` + `useWorkflowRealtime`
 * continua sendo a única fonte (sem mudanças de comportamento).
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sessionsRepo } from "../data/sessionsRepo";
import { workflowStore } from "../store/workflowStore";
import type { WorkflowSession } from "../domain/session";

type Stats = { upserts: number; removes: number; ignored: number; lastEventAt: number };

function emitLegacyEvent(
  session: WorkflowSession | null,
  kind: "update" | "insert" | "delete",
  sessionId?: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("workflow-session-updated", {
        detail: { kind, session, sessionId: sessionId ?? session?.id ?? null, source: "realtime-v2" },
      }),
    );
    if (kind === "delete" && sessionId) {
      window.dispatchEvent(
        new CustomEvent("workflow-session-deleted", {
          detail: { sessionId, source: "realtime-v2" },
        }),
      );
    }
  } catch {
    /* noop */
  }
}

export function useWorkflowRealtimeV2(): { enabled: boolean; stats: Stats } {
  const { user } = useAuth();
  const userId = user?.id;
  const statsRef = useRef<Stats>({ upserts: 0, removes: 0, ignored: 0, lastEventAt: 0 });
  // Onda 3 — ligado por padrão no Preview. Para desativar explicitamente,
  // definir VITE_WORKFLOW_REALTIME_V2="false". Qualquer outro valor (ou ausência) = habilitado.
  const flag = (import.meta.env.VITE_WORKFLOW_REALTIME_V2 ?? "").toString().toLowerCase();
  const enabled = flag !== "false" && flag !== "0";

  useEffect(() => {
    if (!enabled || !userId) return;

    let cancelled = false;
    // Debounce leve para UPDATE (similar ao canal legado).
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `workflow:user:${userId}`;

    async function hydrateAndUpsert(id: string) {
      try {
        const fresh = await sessionsRepo.getById(userId!, id);
        if (cancelled) return;
        // Sessão sumiu do filtro (deletada de fato): remover do store.
        if (!fresh) {
          workflowStore.remove(id);
          statsRef.current.removes++;
          emitLegacyEvent(null, "delete", id);
          return;
        }
        // Soft-delete (status='historico') também sai do funil.
        if ((fresh as any).status === "historico") {
          workflowStore.remove(id);
          statsRef.current.removes++;
          emitLegacyEvent(null, "delete", id);
          return;
        }
        workflowStore.upsert(fresh);
        statsRef.current.upserts++;
        emitLegacyEvent(fresh, "update");
      } catch (err) {
        console.warn("[realtime-v2] hydrate failed", id, err);
      }
    }

    async function hydrateBySessionText(sessionIdText: string) {
      try {
        const fresh = await sessionsRepo.getBySessionId(userId!, sessionIdText);
        if (cancelled || !fresh) return;
        if ((fresh as any).status === "historico") {
          workflowStore.remove(fresh.id);
          statsRef.current.removes++;
          emitLegacyEvent(null, "delete", fresh.id);
          return;
        }
        workflowStore.upsert(fresh);
        statsRef.current.upserts++;
        emitLegacyEvent(fresh, "update");
      } catch (err) {
        console.warn("[realtime-v2] hydrate by sessionId failed", sessionIdText, err);
      }
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes_sessoes", filter: `user_id=eq.${userId}` },
        (payload) => {
          statsRef.current.lastEventAt = Date.now();
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string } | null;
            if (oldRow?.id) {
              workflowStore.remove(oldRow.id);
              statsRef.current.removes++;
              emitLegacyEvent(null, "delete");
            }
            return;
          }
          const row = payload.new as { id?: string } | null;
          if (!row?.id) return;
          // INSERT processa direto; UPDATE com debounce 150ms.
          if (payload.eventType === "INSERT") {
            void hydrateAndUpsert(row.id);
          } else {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => void hydrateAndUpsert(row.id!), 150);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes_transacoes", filter: `user_id=eq.${userId}` },
        (payload) => {
          statsRef.current.lastEventAt = Date.now();
          const sessionIdText =
            (payload.new as { session_id?: string } | null)?.session_id ??
            (payload.old as { session_id?: string } | null)?.session_id;
          if (!sessionIdText) return;
          // Aguarda triggers DB recalcularem valor_pago.
          setTimeout(() => void hydrateBySessionText(sessionIdText), 350);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // eslint-disable-next-line no-console
          console.log(`[realtime-v2] subscribed: ${channelName}`);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[realtime-v2] status=${status}`);
        }
      });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled, userId]);

  return { enabled, stats: statsRef.current };
}
