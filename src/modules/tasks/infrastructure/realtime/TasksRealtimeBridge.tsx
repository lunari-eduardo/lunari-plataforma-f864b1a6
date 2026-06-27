/**
 * Bridge — monta o canal realtime único e hidrata o `tasksStore`.
 *
 * Onda Realtime-instantâneo:
 *  - Hidratação inicial via `supabaseTasksRepo.list`.
 *  - Re-hidratação automática quando a aba volta a ficar visível (>30s offline).
 *  - Re-hidratação reativa se o canal cair (status `CHANNEL_ERROR`/`TIMED_OUT`),
 *    com backoff 1s → 3s → 10s.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseTasksRepo } from "../supabase/tasksRepo";
import { tasksRealtime } from "./tasksRealtimeChannel";
import { tasksStore } from "../../presentation/store/tasksStore";

const VISIBILITY_REHYDRATE_AFTER_MS = 30_000;
const BACKOFF_MS = [1_000, 3_000, 10_000];

export function TasksRealtimeBridge() {
  const { user } = useAuth();
  const hiddenSinceRef = useRef<number | null>(null);
  const backoffIdxRef = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const hydrate = async () => {
      try {
        const list = await supabaseTasksRepo.list({ userId: user.id });
        if (!cancelled) {
          tasksStore.hydrate(list);
          backoffIdxRef.current = 0;
        }
      } catch (err) {
        console.error("[TasksRealtimeBridge] hidratação falhou", err);
        scheduleRehydrate();
      }
    };

    const scheduleRehydrate = () => {
      if (cancelled) return;
      const delay = BACKOFF_MS[Math.min(backoffIdxRef.current, BACKOFF_MS.length - 1)];
      backoffIdxRef.current += 1;
      if (backoffTimer) clearTimeout(backoffTimer);
      backoffTimer = setTimeout(() => {
        void hydrate();
      }, delay);
    };

    void hydrate();

    const cleanup = tasksRealtime.subscribe(user.id, undefined, (status) => {
      // Status do canal Realtime: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        scheduleRehydrate();
      } else if (status === "SUBSCRIBED") {
        backoffIdxRef.current = 0;
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSinceRef.current = Date.now();
        return;
      }
      const since = hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      if (since && Date.now() - since >= VISIBILITY_REHYDRATE_AFTER_MS) {
        void hydrate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (backoffTimer) clearTimeout(backoffTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      cleanup();
    };
  }, [user?.id]);

  return null;
}
