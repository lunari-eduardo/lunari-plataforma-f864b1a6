/**
 * Bridge — monta o canal Realtime único do módulo Finance e hidrata os stores.
 *
 * - Hidratação inicial via `supabaseTransactionsRepo.listAll` + `supabaseItemsRepo.listAll`.
 * - Re-hidratação quando a aba volta a ficar visível (>30s offline).
 * - Re-hidratação reativa se o canal cair (`CHANNEL_ERROR`/`TIMED_OUT`),
 *   com backoff 1s → 3s → 10s.
 * - Invalida `['extrato']` de forma debounced quando há mudanças em transações.
 *
 * Ativado por flag `VITE_FINANCE_REALTIME_V2` (default: true no preview).
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseTransactionsRepo } from "../supabase/transactionsRepo";
import { supabaseItemsRepo } from "../supabase/itemsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { itemsStore } from "../../presentation/store/itemsStore";
import { financeRealtime } from "./financeRealtimeChannel";

const VISIBILITY_REHYDRATE_AFTER_MS = 30_000;
const BACKOFF_MS = [1_000, 3_000, 10_000];
const EXTRATO_DEBOUNCE_MS = 400;
const TX_DEBOUNCE_MS = 200;
const ITEMS_DEBOUNCE_MS = 200;

const FLAG_ENABLED =
  (import.meta.env.VITE_FINANCE_REALTIME_V2 ?? "true").toString().toLowerCase() !== "false";

export function FinanceRealtimeBridge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hiddenSinceRef = useRef<number | null>(null);
  const backoffIdxRef = useRef(0);
  const extratoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!FLAG_ENABLED) return;
    if (!user?.id) return;

    let cancelled = false;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const hydrate = async () => {
      try {
        const [txs, items] = await Promise.all([
          supabaseTransactionsRepo.listAll(),
          supabaseItemsRepo.listAll(),
        ]);
        if (!cancelled) {
          transactionsStore.hydrate(txs);
          itemsStore.hydrate(items);
          backoffIdxRef.current = 0;
        }
      } catch (err) {
        console.error("[FinanceRealtimeBridge] hidratação falhou", err);
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

    const invalidateExtratoDebounced = () => {
      if (extratoTimerRef.current) clearTimeout(extratoTimerRef.current);
      extratoTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["extrato"] });
      }, EXTRATO_DEBOUNCE_MS);
    };

    void hydrate();

    const cleanup = financeRealtime.subscribe(
      user.id,
      (evt) => {
        if (evt.entity === "transaction") {
          invalidateExtratoDebounced();
        }
      },
      (status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleRehydrate();
        } else if (status === "SUBSCRIBED") {
          backoffIdxRef.current = 0;
        }
      },
    );

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
      if (extratoTimerRef.current) clearTimeout(extratoTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      cleanup();
    };
  }, [user?.id, queryClient]);

  return null;
}
