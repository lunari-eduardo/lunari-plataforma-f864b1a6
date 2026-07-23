import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const initialCold: WorkflowMetrics = {
  ...EMPTY_DATA,
  isColdLoading: true,
  isRevalidating: false,
  isLoading: true,
};

/**
 * Métricas do Workflow com padrão SWR (stale-while-revalidate).
 *
 * Fluxo:
 * 1. Cache-hit síncrono → renderiza dado antigo com `isRevalidating=true`.
 *    A tabela permanece INTERATIVA (Workflow.tsx não bloqueia em revalidate).
 * 2. Cache-miss síncrono → tenta IDB assíncrono; se achar promove para hit.
 *    Caso contrário mantém `isColdLoading=true` → skeleton.
 * 3. RPC sempre é disparado (com dedup) e, ao chegar, atualiza + cache.
 * 4. Eventos de pagamento/card_updated invalidam cache e refazem SWR.
 */
export function useWorkflowMetricsRealtime(
  year: number,
  month?: number,
  startDateOverride?: string,
  endDateOverride?: string,
): WorkflowMetrics {
  const [metrics, setMetrics] = useState<WorkflowMetrics>(initialCold);
  const loaderRef = useRef<() => void>(() => {});
  const userIdRef = useRef<string | null>(null);

  // Reset síncrono a cada troca de mês/override: evita renderizar
  // números do mês anterior enquanto o novo mês carrega (percebido
  // pelo usuário como "métricas não atualizaram").
  useEffect(() => {
    setMetrics((prev) => ({ ...prev, isColdLoading: true, isRevalidating: false, isLoading: true }));
  }, [year, month, startDateOverride, endDateOverride]);

  useEffect(() => {
    let cancelled = false;
    const usingOverride = Boolean(startDateOverride && endDateOverride);
    const cacheableMonth = !usingOverride && typeof month === "number";

    // Seed inicial: se há cache síncrono, começa em revalidate; senão cold.
    const seedFromCacheSync = async (userId: string) => {
      if (!cacheableMonth) {
        setMetrics((prev) => ({ ...prev, isColdLoading: true, isRevalidating: false, isLoading: true }));
        return;
      }

      const hit = metricsCache.getSync(userId, year, month!);
      if (hit) {
        setMetrics({
          ...hit,
          isColdLoading: false,
          isRevalidating: true,
          isLoading: false,
        });
        return;
      }
      // Miss síncrono → mostra cold e tenta IDB
      setMetrics({ ...EMPTY_DATA, isColdLoading: true, isRevalidating: false, isLoading: true });
      const persisted = await metricsCache.get(userId, year, month!);
      if (cancelled || !persisted) return;
      setMetrics({
        ...persisted,
        isColdLoading: false,
        isRevalidating: true,
        isLoading: false,
      });
    };

    const loadFresh = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setMetrics({ ...EMPTY_DATA, isColdLoading: false, isRevalidating: false, isLoading: false });
          return;
        }
        userIdRef.current = user.id;

        // Se veio override de datas, mantém caminho legado (sem cache).
        if (usingOverride) {
          const rpc = supabase.rpc("workflow_month_metrics", {
            p_user_id: user.id,
            p_start: startDateOverride!,
            p_end: endDateOverride!,
          });
          // AbortController: cliques rápidos entre meses cancelam RPC antiga
          // antes de disputar conexão PG com o novo mês.
          const controller = new AbortController();
          const abortHandler = () => controller.abort();
          // Nota: supabase.rpc não expõe abortSignal direto até v2.60; usamos
          // race com um timeout defensivo de 6s para não travar a UI.
          const timeout = setTimeout(() => abortHandler(), 6000);
          const { data, error } = await rpc;
          clearTimeout(timeout);
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

        // Semeia da cache antes de ir ao RPC.
        await seedFromCacheSync(user.id);
        if (cancelled) return;

        const fresh = await fetchMonthMetrics(user.id, year, month!);
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
      const uid = userIdRef.current;
      if (uid && cacheableMonth) {
        // Invalida TTL do repo (força RPC) — cache permanece para SWR.
        invalidateMonthMetricsTTL(uid, year, month!);
      }
      // Marca revalidação (mantém números visíveis)
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
  }, [year, month, startDateOverride, endDateOverride]);

  return metrics;
}
