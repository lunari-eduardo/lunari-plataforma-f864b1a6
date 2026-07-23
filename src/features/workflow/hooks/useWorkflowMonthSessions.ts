import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkflowCache, type MonthLoadState } from "@/contexts/WorkflowCacheContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import { eventBus } from "@/shared/event-bus";
import type { WorkflowSession } from "@/features/workflow";

const HEARTBEAT_MS = 5 * 60 * 1000; // 5 min — revalidação silenciosa enquanto visível
const PERSISTED_TTL_MS = 6 * 60 * 60 * 1000; // 6 h — invalida mês persistido "antigo"

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
 * Correções (troca de mês):
 *  - Ao mudar `currentMonth`, se não há cache, `workflowSessions` é ZERADO
 *    antes do fetch — evita mostrar dados do mês anterior enquanto carrega.
 *  - Guarda de mês atual (ref) impede que `subscribe` ou fetches lentos
 *    reintroduzam dados de mês obsoleto após cliques rápidos.
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
    getMonthStatus,
    subscribeMonthStatus,
    retryMonth,
  } = useWorkflowCache();

  const [currentMonth, setCurrentMonth] = usePersistedState<WorkflowCurrentMonth>(
    "workflow_current_month",
    { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  );

  const [workflowSessions, setWorkflowSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(false);
  /** true durante troca de mês sem cache — usado pela UI para cross-fade. */
  const [isSwitchingMonth, setIsSwitchingMonth] = useState(false);
  const [monthState, setMonthStateLocal] = useState<MonthLoadState>(() =>
    getMonthStatus(currentMonth.year, currentMonth.month),
  );
  const error = monthState.status === "error" ? monthState.error : null;

  // Subscribe ao state machine do mês corrente.
  useEffect(() => {
    setMonthStateLocal(getMonthStatus(currentMonth.year, currentMonth.month));
    const off = subscribeMonthStatus(currentMonth.year, currentMonth.month, setMonthStateLocal);
    return off;
  }, [currentMonth.year, currentMonth.month, getMonthStatus, subscribeMonthStatus]);

  // Ref sempre com o mês corrente — usada como guarda contra writes de fetches
  // antigos que resolveriam após o usuário já ter mudado de mês.
  const currentMonthRef = useRef(currentMonth);
  useEffect(() => { currentMonthRef.current = currentMonth; }, [currentMonth]);

  // Marca quando o usuário navegou manualmente — impede o TTL de reescrever.
  const manuallyNavigatedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());

  // FASE 0 — TTL do mês persistido:
  // Se a aba ficou fechada/idle por >6h e o mês persistido não é o atual,
  // e o usuário ainda não navegou manualmente nesta sessão, força "hoje".
  useEffect(() => {
    const lastLoadStr = typeof window !== "undefined"
      ? window.sessionStorage.getItem("workflow_current_month__lastLoadAt")
      : null;
    const lastLoad = lastLoadStr ? Number(lastLoadStr) : 0;
    const now = new Date();
    const isCurrentRealMonth =
      currentMonth.year === now.getFullYear() && currentMonth.month === now.getMonth() + 1;
    if (
      !manuallyNavigatedRef.current &&
      lastLoad > 0 &&
      now.getTime() - lastLoad > PERSISTED_TTL_MS &&
      !isCurrentRealMonth
    ) {
      console.log("[Workflow] mês persistido antigo (>6h) → resetando para hoje");
      setCurrentMonth({ month: now.getMonth() + 1, year: now.getFullYear() });
    }
    try {
      window.sessionStorage.setItem(
        "workflow_current_month__lastLoadAt",
        String(Date.now()),
      );
    } catch { /* noop */ }
    // Roda uma vez no mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMonth = async () => {
      const key = `${currentMonth.year}-${currentMonth.month}`;
      const cached = getSessionsForMonthSync(currentMonth.year, currentMonth.month);
      if (cached !== null) {
        console.log(`⚡ [Workflow] Cache hit for ${key} (${cached.length} sessions)`);
        setWorkflowSessions(cached);
        setIsSwitchingMonth(false);
        // Não dispara ensureMonthLoaded aqui — heartbeat (5min) + visibility
        // + subscribe realtime já cobrem revalidação; extra fetch inflava
        // conexão e concorria com métricas na mesma janela de troca.
        return;
      }

      // Sem cache → MANTER dados anteriores visíveis (cross-fade).
      // Só sobrescreve quando o novo mês chegar.
      setIsSwitchingMonth(true);
      setLoading(true);
      console.log(`🔄 [Workflow] No cache for ${key}, fetching from Supabase...`);
      try {
        await ensureMonthLoaded(currentMonth.year, currentMonth.month, true);
        if (cancelled) return;
        const ref = currentMonthRef.current;
        if (ref.year === currentMonth.year && ref.month === currentMonth.month) {
          const fresh = getSessionsForMonthSync(currentMonth.year, currentMonth.month);
          setWorkflowSessions(fresh ?? []);
        }
      } catch (err) {
        console.error(`❌ [Workflow] Error loading month:`, err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsSwitchingMonth(false);
        }
      }
    };
    loadMonth();
    return () => { cancelled = true; };
  }, [currentMonth.year, currentMonth.month, ensureMonthLoaded, getSessionsForMonthSync]);

  // FASE 2 — visibilitychange + heartbeat de revalidação silenciosa.
  useEffect(() => {
    const revalidateMonth = (reason: "visibility" | "heartbeat") => {
      // SWR silencioso: nunca dispara loading state.
      ensureMonthLoaded(currentMonth.year, currentMonth.month, false).catch(() => {});
      // Sinaliza métricas para revalidarem também.
      void eventBus.emit("workflow.metrics_stale", { reason });
    };

    const handler = () => {
      if (document.visibilityState !== "visible") return;
      revalidateMonth("visibility");
    };
    document.addEventListener("visibilitychange", handler);

    let interval: ReturnType<typeof setInterval> | null = null;
    const startHeartbeat = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === "visible") revalidateMonth("heartbeat");
      }, HEARTBEAT_MS);
    };
    startHeartbeat();

    return () => {
      document.removeEventListener("visibilitychange", handler);
      if (interval) clearInterval(interval);
    };
  }, [currentMonth.year, currentMonth.month, ensureMonthLoaded]);

  // Subscribe ao cache (realtime) — filtra sempre pelo mês corrente (ref)
  useEffect(() => {
    return subscribe((allSessions) => {
      const ref = currentMonthRef.current;
      // Guarda: só aceita updates para o mês visível
      if (ref.year !== currentMonth.year || ref.month !== currentMonth.month) return;

      const filtered = allSessions.filter((s) => {
        if (!s.data_sessao) return false;
        const [year, month] = s.data_sessao.split("-").map(Number);
        return year === currentMonth.year && month === currentMonth.month;
      });
      setWorkflowSessions((prev) => {
        const produtosSig = (s: WorkflowSession) => {
          const arr = Array.isArray(s.produtos_incluidos) ? s.produtos_incluidos : [];
          return arr
            .map((p: any) => {
              const etapas = Array.isArray(p?.etapas)
                ? p.etapas.map((e: any) => (e?.done ? "1" : "0")).join("")
                : "";
              return `${p?.id ?? p?.produtoId ?? p?.nome ?? ""}:${p?.fluxo ?? ""}:${etapas}:${p?.entregue ? 1 : 0}`;
            })
            .join("|");
        };
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
              produtosSig(s) !== produtosSig(p)
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
    manuallyNavigatedRef.current = true;
    setCurrentMonth((prev) =>
      prev.month === 1 ? { month: 12, year: prev.year - 1 } : { month: prev.month - 1, year: prev.year },
    );
  }, [setCurrentMonth]);

  const goNext = useCallback(() => {
    manuallyNavigatedRef.current = true;
    setCurrentMonth((prev) =>
      prev.month === 12 ? { month: 1, year: prev.year + 1 } : { month: prev.month + 1, year: prev.year },
    );
  }, [setCurrentMonth]);

  const goToday = useCallback(() => {
    manuallyNavigatedRef.current = true;
    setCurrentMonth({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  }, [setCurrentMonth]);

  /**
   * Aplica um delta acumulado (após coalescing no switcher). Um único
   * setState → um único fetch para o mês final.
   */
  const applyDelta = useCallback((delta: number | "today") => {
    manuallyNavigatedRef.current = true;
    if (delta === "today") {
      const now = new Date();
      setCurrentMonth({ month: now.getMonth() + 1, year: now.getFullYear() });
      return;
    }
    if (!Number.isFinite(delta) || delta === 0) return;
    setCurrentMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      return { month: m, year: y };
    });
  }, [setCurrentMonth]);

  return {
    currentMonth,
    setCurrentMonth,
    workflowSessions,
    setWorkflowSessions,
    loading,
    isSwitchingMonth,
    error,
    monthStatus: monthState.status,
    monthLoadedAt: monthState.loadedAt,
    retryCurrentMonth: () => retryMonth(currentMonth.year, currentMonth.month),
    isPreloading,
    isLoadingCurrentMonth: isLoadingMonth(currentMonth.year, currentMonth.month),
    mergeUpdate,
    removeSessionFromCache,
    forceRefresh,
    ensureMonthLoaded,
    goPrev,
    goNext,
    goToday,
    applyDelta,
  };
}
