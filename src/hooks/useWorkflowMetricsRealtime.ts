import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { USE_METRICS_EVENT_BUS } from "@/features/workflow/config";
import { eventBus } from "@/shared/event-bus";
import { metricsCache } from "@/features/workflow/data/metricsCache";
import { fetchMonthMetrics, invalidateMonthMetricsTTL } from "@/features/workflow/data/metricsRepo";

export interface WorkflowMetrics {
  previsto: number;
  receita: number;
  aReceber: number;
  sessoes: number;
  creditosGerados: number;
  creditosUtilizados: number;
  caixaRecebido: number;
  /** true quando NÃO há dado exibível (nem cache) — UI mostra skeleton. */
  isColdLoading: boolean;
  /** true quando há dado visível mas um refresh está em curso — UI NÃO bloqueia. */
  isRevalidating: boolean;
  /** @deprecated alias de `isColdLoading` para compat com componentes existentes. */
  isLoading: boolean;
}

const EMPTY_DATA = {
  previsto: 0,
  receita: 0,
  aReceber: 0,
  sessoes: 0,
  creditosGerados: 0,
  creditosUtilizados: 0,
  caixaRecebido: 0,
};

const COLD: WorkflowMetrics = {
  ...EMPTY_DATA,
  isColdLoading: true,
  isRevalidating: false,
  isLoading: true,
};

function seedFromCache(userId: string | null, year: number, month?: number, override?: boolean): WorkflowMetrics {
  if (override || !userId || typeof month !== "number") return COLD;
  const hit = metricsCache.getSync(userId, year, month);
  if (!hit) return COLD;
  return { ...hit, isColdLoading: false, isRevalidating: true, isLoading: false };
}

/**
 * Métricas do Workflow com padrão SWR (stale-while-revalidate).
 *
 * Mudanças (tranche de performance):
 *  - `userId` vem do `AuthContext` (sem `supabase.auth.getUser()` por load).
 *    Elimina 200–800ms de round-trip em cada troca de mês.
 *  - Seed síncrono do `metricsCache` no `useState` inicial e no reset por
 *    troca de mês: se há cache, a UI NUNCA vai para skeleton — vai direto
 *    para `isRevalidating` com os números do cache. Volta para skeleton só
 *    quando não há cache mesmo.
 *  - Removido o `setTimeout(6000)` que fingia cancelamento — o cancelamento
 *    real vive no coordinator de meses (WorkflowCacheContext).
 */
export function useWorkflowMetricsRealtime(
  year: number,
  month?: number,
  startDateOverride?: string,
  endDateOverride?: string,
): WorkflowMetrics {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const usingOverride = Boolean(startDateOverride && endDateOverride);

  const [metrics, setMetrics] = useState<WorkflowMetrics>(() =>
    seedFromCache(userId, year, month, usingOverride),
  );
  const loaderRef = useRef<() => void>(() => {});

  // Reset por troca de mês/override/userId: seed novo do cache. Sem flash.
  useEffect(() => {
    setMetrics(seedFromCache(userId, year, month, usingOverride));
  }, [userId, year, month, startDateOverride, endDateOverride, usingOverride]);

  useEffect(() => {
    let cancelled = false;
    const cacheableMonth = !usingOverride && typeof month === "number";

    const loadFresh = async () => {
      try {
        if (!userId) {
          setMetrics({ ...EMPTY_DATA, isColdLoading: false, isRevalidating: false, isLoading: false });
          return;
        }

        // Caminho override (dashboard): sem cache; RPC direto.
        if (usingOverride) {
          const { data, error } = await supabase.rpc("workflow_month_metrics", {
            p_user_id: userId,
            p_start: startDateOverride!,
            p_end: endDateOverride!,
          });
          if (cancelled) return;
          if (error) throw error;
          const row: any = Array.isArray(data) ? data[0] : data;
          if (!row) {
            setMetrics({ ...EMPTY_DATA, isColdLoading: false, isRevalidating: false, isLoading: false });
            return;
          }
          setMetrics({
            previsto: Number(row.previsto) || 0,
            receita: Number(row.receita) || 0,
            aReceber: Number(row.pendente) || 0,
            sessoes: Number(row.sessoes) || 0,
            creditosGerados: Number(row.creditos_gerados) || 0,
            creditosUtilizados: Number(row.creditos_utilizados) || 0,
            caixaRecebido: Number(row.caixa_recebido) || 0,
            isColdLoading: false,
            isRevalidating: false,
            isLoading: false,
          });
          return;
        }

        if (!cacheableMonth) return;

        const fresh = await fetchMonthMetrics(userId, year, month!);
        if (cancelled) return;
        if (!fresh) {
          setMetrics((prev) => ({ ...prev, isColdLoading: false, isRevalidating: false, isLoading: false }));
          return;
        }
        setMetrics({
          ...fresh,
          isColdLoading: false,
          isRevalidating: false,
          isLoading: false,
        });
      } catch (err) {
        console.error("❌ [WorkflowMetricsRealtime]", err);
        if (!cancelled) {
          setMetrics((prev) => ({ ...prev, isColdLoading: false, isRevalidating: false, isLoading: false }));
        }
      }
    };

    loaderRef.current = () => { void loadFresh(); };
    void loadFresh();

    // Coalescing: eventos em rajada geram um único reload após 300ms de calmaria.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidateAndReload = () => {
      if (userId && cacheableMonth) {
        invalidateMonthMetricsTTL(userId, year, month!);
      }
      setMetrics((prev) => ({ ...prev, isRevalidating: true }));
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        loaderRef.current();
      }, 300);
    };

    if (USE_METRICS_EVENT_BUS) {
      const offCard = eventBus.on("workflow.card_updated", invalidateAndReload);
      const offAdv = eventBus.on("workflow.card_advanced", invalidateAndReload);
      const offDel = eventBus.on("workflow.card_deleted", invalidateAndReload);
      const offPay = eventBus.on("workflow.payment_added", invalidateAndReload);
      const offRef = eventBus.on("workflow.payment_refunded", invalidateAndReload);
      const offAtt = eventBus.on("workflow.payment_attached", invalidateAndReload);
      const offStale = eventBus.on("workflow.metrics_stale", invalidateAndReload);
      window.addEventListener("workflow-session-updated", invalidateAndReload);
      window.addEventListener("workflow-session-deleted", invalidateAndReload);
      window.addEventListener("payment-created", invalidateAndReload);
      return () => {
        cancelled = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        offCard(); offAdv(); offDel(); offPay(); offRef(); offAtt(); offStale();
        window.removeEventListener("workflow-session-updated", invalidateAndReload);
        window.removeEventListener("workflow-session-deleted", invalidateAndReload);
        window.removeEventListener("payment-created", invalidateAndReload);
      };
    }

    const channel = supabase
      .channel(`workflow-metrics-${year}-${month || "all"}-${startDateOverride || ""}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes_sessoes" }, invalidateAndReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes_transacoes" }, invalidateAndReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente_creditos_ledger" }, invalidateAndReload)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, year, month, startDateOverride, endDateOverride, usingOverride]);

  return metrics;
}
