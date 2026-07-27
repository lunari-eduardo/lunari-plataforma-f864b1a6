/**
 * Onda 3 — Realtime unificado (v2), com watchdog de reconexão.
 *
 * 1 canal único `workflow:user:{userId}` ouvindo `clientes_sessoes` e
 * `clientes_transacoes` filtrados por `user_id`.
 *
 * Onda C (resiliência):
 *  - Em `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`: teardown + resubscribe com
 *    backoff exponencial (1s, 3s, 10s, 30s, teto 60s). Reset ao próximo
 *    `SUBSCRIBED`.
 *  - Em `visibilitychange → visible`: se `Date.now() - lastEventAt > 5min`,
 *    força resubscribe preventivo (evita canais zumbis após idle).
 *  - Após reconectar, emite `workflow.metrics_stale` para revalidar métricas.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sessionsRepo } from "../data/sessionsRepo";
import { workflowStore } from "../store/workflowStore";
import { eventBus } from "@/shared/event-bus";
import type { WorkflowSession } from "../domain/session";

/**
 * Onda 1 do plano "Realtime end-to-end" — resolve `session_id` textual
 * (slug workflow-*) para o UUID canônico via cache local, sem hop no DB.
 * Emite apenas `workflow-session-financials-stale` (não reidrata a linha
 * inteira da sessão, só invalida os financeiros no `useSessionFinancials`).
 */
function emitFinancialsStaleBySlug(sessionText: string | null | undefined) {
  if (!sessionText || typeof window === "undefined") return;
  const cached = workflowStore.getBySessionId(sessionText);
  const uuid = cached?.id ?? null;
  try {
    window.dispatchEvent(
      new CustomEvent("workflow-session-financials-stale", {
        detail: { sessionId: uuid, sessionSlug: sessionText, source: "realtime-v2" },
      }),
    );
  } catch {
    /* noop */
  }
}


type Stats = { upserts: number; removes: number; ignored: number; lastEventAt: number };

const IDLE_RESUB_MS = 5 * 60 * 1000; // 5 min sem eventos → resubscribe preventivo
const BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 60_000];

function emitLegacyEvent(
  session: WorkflowSession | null,
  kind: "update" | "insert" | "delete",
  sessionId?: string | null,
) {
  if (typeof window === "undefined") return;
  const affectedId = sessionId ?? session?.id ?? null;
  try {
    window.dispatchEvent(
      new CustomEvent("workflow-session-updated", {
        detail: { kind, session, sessionId: affectedId, source: "realtime-v2" },
      }),
    );
    if (affectedId) {
      window.dispatchEvent(
        new CustomEvent("workflow-session-financials-stale", {
          detail: { sessionId: affectedId, source: "realtime-v2" },
        }),
      );
    }
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
  const flag = (import.meta.env.VITE_WORKFLOW_REALTIME_V2 ?? "").toString().toLowerCase();
  const enabled = flag !== "false" && flag !== "0";

  useEffect(() => {
    if (!enabled || !userId) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffIndex = 0;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    const channelName = `workflow:user:${userId}`;

    const clearReconnectTimer = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    async function hydrateAndUpsert(id: string) {
      try {
        const fresh = await sessionsRepo.getById(userId!, id);
        if (cancelled) return;
        if (!fresh) {
          workflowStore.remove(id);
          statsRef.current.removes++;
          emitLegacyEvent(null, "delete", id);
          return;
        }
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

    const scheduleReconnect = (reason: string) => {
      if (cancelled) return;
      clearReconnectTimer();
      const delay = BACKOFF_MS[Math.min(backoffIndex, BACKOFF_MS.length - 1)];
      backoffIndex++;
      console.warn(`[realtime-v2] reconnect scheduled in ${delay}ms (reason=${reason})`);
      reconnectTimer = setTimeout(() => {
        if (cancelled) return;
        teardownChannel();
        subscribe();
      }, delay);
    };

    const teardownChannel = () => {
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch { /* noop */ }
        currentChannel = null;
      }
    };

    const subscribe = () => {
      if (cancelled) return;
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
                emitLegacyEvent(null, "delete", oldRow.id);
              }
              return;
            }
            const row = payload.new as { id?: string; session_id?: string } | null;
            if (!row?.id) return;
            if (payload.eventType === "INSERT") {
              void hydrateAndUpsert(row.id);
              // Onda 1 (2.6): sinaliza slug novo para o WorkflowMonthDataProvider
              // refetchar galerias sem esperar o array de slugs re-renderizar.
              if (row.session_id && typeof window !== "undefined") {
                try {
                  window.dispatchEvent(
                    new CustomEvent("workflow-month-slug-added", {
                      detail: { slug: row.session_id, sessionId: row.id, source: "realtime-v2" },
                    }),
                  );
                } catch { /* noop */ }
              }
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
            // Invalida financeiros imediatamente (não espera o hydrate).
            emitFinancialsStaleBySlug(sessionIdText);
            setTimeout(() => void hydrateBySessionText(sessionIdText), 350);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cobrancas", filter: `user_id=eq.${userId}` },
          (payload) => {
            statsRef.current.lastEventAt = Date.now();
            const sessionIdText =
              (payload.new as { session_id?: string } | null)?.session_id ??
              (payload.old as { session_id?: string } | null)?.session_id;
            emitFinancialsStaleBySlug(sessionIdText);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cobranca_parcelas", filter: `user_id=eq.${userId}` },
          async (payload) => {
            statsRef.current.lastEventAt = Date.now();
            const cobrancaId =
              (payload.new as { cobranca_id?: string } | null)?.cobranca_id ??
              (payload.old as { cobranca_id?: string } | null)?.cobranca_id;
            if (!cobrancaId) return;
            // Resolve a cobrança pai → session_id textual → UUID via store.
            try {
              const { data } = await supabase
                .from("cobrancas")
                .select("session_id")
                .eq("id", cobrancaId)
                .maybeSingle();
              emitFinancialsStaleBySlug((data as { session_id?: string } | null)?.session_id);
            } catch (err) {
              console.warn("[realtime-v2] cobranca_parcelas resolve failed", err);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cliente_creditos_ledger", filter: `user_id=eq.${userId}` },
          (payload) => {
            statsRef.current.lastEventAt = Date.now();
            const nw = payload.new as { session_id_origem?: string; session_id_consumo?: string } | null;
            const ol = payload.old as { session_id_origem?: string; session_id_consumo?: string } | null;
            const slugs = new Set(
              [nw?.session_id_origem, nw?.session_id_consumo, ol?.session_id_origem, ol?.session_id_consumo]
                .filter(Boolean) as string[],
            );
            slugs.forEach((slug) => emitFinancialsStaleBySlug(slug));
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "galerias", filter: `user_id=eq.${userId}` },
          (payload) => {
            statsRef.current.lastEventAt = Date.now();
            const slug =
              (payload.new as { session_id?: string } | null)?.session_id ??
              (payload.old as { session_id?: string } | null)?.session_id;
            emitFinancialsStaleBySlug(slug);
          },
        )



        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            const wasReconnecting = backoffIndex > 0;
            backoffIndex = 0;
            clearReconnectTimer();
            statsRef.current.lastEventAt = Date.now();
            console.log(`[realtime-v2] subscribed: ${channelName}`);
            if (wasReconnecting) {
              // Após qualquer reconexão real, métricas podem estar stale.
              void eventBus.emit("workflow.metrics_stale", { reason: "reconnect" });
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            scheduleReconnect(status);
          }
        });

      currentChannel = channel;
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = statsRef.current.lastEventAt;
      const idle = last === 0 || Date.now() - last > IDLE_RESUB_MS;
      if (idle) {
        console.log("[realtime-v2] visibility→visible após idle, resubscribing");
        backoffIndex = 0;
        teardownChannel();
        subscribe();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (debounceTimer) clearTimeout(debounceTimer);
      clearReconnectTimer();
      teardownChannel();
    };
  }, [enabled, userId]);

  return { enabled, stats: statsRef.current };
}
