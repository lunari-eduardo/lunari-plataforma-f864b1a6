import { useCallback, useEffect, useState } from "react";
import { useWorkflowCache } from "@/contexts/WorkflowCacheContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { WorkflowSession } from "@/hooks/useWorkflowRealtime";

export type WorkflowCurrentMonth = { month: number; year: number };

/**
 * Onda 5a — extrai do god-component:
 *  - persistência do mês corrente (sessionStorage)
 *  - hidratação inicial via cache + ensureMonthLoaded
 *  - subscribe ao cache para refletir realtime
 *  - listener de fallback `workflow-session-updated`/`workflow-session-deleted`
 *  - reload no visibilitychange
 *  - navegação de mês (prev/next/today)
 *
 * Comportamento preservado bit-a-bit do Workflow.tsx original.
 */
export function useWorkflowMonthSessions() {
  const {
    getSessionsForMonthSync,
    isPreloading,
    subscribe,
    mergeUpdate,
    removeSession: removeSessionFromCache,
    forceRefresh,
    ensureMonthLoaded,
    isLoadingMonth,
  } = useWorkflowCache();

  const [currentMonth, setCurrentMonth] = usePersistedState<WorkflowCurrentMonth>(
    "workflow_current_month",
    { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  );

  const [workflowSessions, setWorkflowSessions] = useState<WorkflowSession[]>(
    () => getSessionsForMonthSync(currentMonth.year, currentMonth.month) || [],
  );
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // FASE 1 — carregar mês corrente (cache-first)
  useEffect(() => {
    const loadMonth = async () => {
      const key = `${currentMonth.year}-${currentMonth.month}`;
      const cached = getSessionsForMonthSync(currentMonth.year, currentMonth.month);
      if (cached !== null) {
        console.log(`⚡ [Workflow] Cache hit for ${key} (${cached.length} sessions)`);
        setWorkflowSessions(cached);
        ensureMonthLoaded(currentMonth.year, currentMonth.month, false);
        return;
      }
      setLoading(true);
      console.log(`🔄 [Workflow] No cache for ${key}, fetching from Supabase...`);
      try {
        await ensureMonthLoaded(currentMonth.year, currentMonth.month, true);
      } catch (err) {
        console.error(`❌ [Workflow] Error loading month:`, err);
      } finally {
        setLoading(false);
      }
    };
    loadMonth();
  }, [currentMonth.year, currentMonth.month, ensureMonthLoaded, getSessionsForMonthSync]);

  // FASE 2 — visibilitychange
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      const cached = getSessionsForMonthSync(currentMonth.year, currentMonth.month);
      if (!cached) ensureMonthLoaded(currentMonth.year, currentMonth.month, true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [currentMonth.year, currentMonth.month, ensureMonthLoaded, getSessionsForMonthSync]);

  // Leitura direta ao trocar mês
  useEffect(() => {
    const sessions = getSessionsForMonthSync(currentMonth.year, currentMonth.month);
    if (sessions) setWorkflowSessions(sessions);
  }, [currentMonth, getSessionsForMonthSync]);

  // Subscribe ao cache (realtime)
  useEffect(() => {
    return subscribe((allSessions) => {
      const filtered = allSessions.filter((s) => {
        if (!s.data_sessao) return false;
        const [year, month] = s.data_sessao.split("-").map(Number);
        return year === currentMonth.year && month === currentMonth.month;
      });
      setWorkflowSessions((prev) => {
        const hasChanges =
          filtered.length !== prev.length ||
          filtered.some((s) => {
            const p = prev.find((x) => x.id === s.id);
            if (!p) return true;
            return (
              s.updated_at !== p.updated_at ||
              s.valor_pago !== p.valor_pago ||
              s.valor_total !== p.valor_total ||
              s.valor_base_pacote !== p.valor_base_pacote ||
              s.valor_total_foto_extra !== p.valor_total_foto_extra ||
              s.valor_adicional !== p.valor_adicional ||
              s.desconto !== p.desconto ||
              s.qtd_fotos_extra !== p.qtd_fotos_extra ||
              s.status !== p.status ||
              (s.produtos_incluidos?.length || 0) !== (p.produtos_incluidos?.length || 0)
            );
          });
        return hasChanges ? filtered : prev;
      });
    });
  }, [currentMonth, subscribe]);

  // FASE 8 — listeners de fallback
  useEffect(() => {
    const handleSessionUpdated = (event: CustomEvent) => {
      const detail = event.detail || {};
      const kind: "update" | "insert" | "delete" | undefined = detail.kind;
      if (kind === "delete") {
        const sessionId: string | undefined = detail.sessionId;
        if (sessionId) {
          setWorkflowSessions((prev) => prev.filter((s) => s.id !== sessionId));
          removeSessionFromCache(sessionId);
        }
        return;
      }
      const fullSession = detail.fullSession ?? detail.session;
      if (fullSession) {
        const sessionDate = new Date(fullSession.data_sessao);
        if (
          sessionDate.getFullYear() === currentMonth.year &&
          sessionDate.getMonth() + 1 === currentMonth.month
        ) {
          mergeUpdate(fullSession);
        }
      }
    };
    const handleSessionDeleted = (event: CustomEvent) => {
      const sessionId: string | undefined = event.detail?.sessionId;
      if (!sessionId) return;
      setWorkflowSessions((prev) => prev.filter((s) => s.id !== sessionId));
      removeSessionFromCache(sessionId);
    };
    window.addEventListener("workflow-session-updated", handleSessionUpdated as EventListener);
    window.addEventListener("workflow-session-deleted", handleSessionDeleted as EventListener);
    return () => {
      window.removeEventListener("workflow-session-updated", handleSessionUpdated as EventListener);
      window.removeEventListener("workflow-session-deleted", handleSessionDeleted as EventListener);
    };
  }, [currentMonth, mergeUpdate, removeSessionFromCache]);

  const goPrev = useCallback(() => {
    setCurrentMonth((prev) =>
      prev.month === 1 ? { month: 12, year: prev.year - 1 } : { month: prev.month - 1, year: prev.year },
    );
  }, [setCurrentMonth]);

  const goNext = useCallback(() => {
    setCurrentMonth((prev) =>
      prev.month === 12 ? { month: 1, year: prev.year + 1 } : { month: prev.month + 1, year: prev.year },
    );
  }, [setCurrentMonth]);

  const goToday = useCallback(() => {
    setCurrentMonth({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  }, [setCurrentMonth]);

  return {
    currentMonth,
    setCurrentMonth,
    workflowSessions,
    setWorkflowSessions,
    loading,
    error,
    isPreloading,
    isLoadingCurrentMonth: isLoadingMonth(currentMonth.year, currentMonth.month),
    mergeUpdate,
    removeSessionFromCache,
    forceRefresh,
    ensureMonthLoaded,
    goPrev,
    goNext,
    goToday,
  };
}
