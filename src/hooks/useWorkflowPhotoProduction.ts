import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { photoProductionCache, type CachedPhotoProduction } from "@/features/workflow/data/photoProductionCache";
import { eventBus } from "@/shared/event-bus";
import { execute } from "@/shared/capability";
import "@/modules/workflow";

/**
 * Hook para métricas de produção fotográfica do Workflow.
 *
 * - Sem `month`: retorna série mensal (12 pontos) + agregado anual.
 * - Com `month` (1..12): retorna apenas aquele mês.
 * - SWR: mostra cache imediatamente, revalida em background.
 * - Reagimos ao eventBus do Workflow para invalidar em pagamentos/edições.
 */

export interface MonthlyPhotoProduction extends CachedPhotoProduction {
  month: number; // 1..12
}

export interface AnnualPhotoProduction {
  fotosIncluidas: number;
  fotosExtras: number;
  fotosTotal: number;
  sessoesComPacote: number;
  sessoesSemPacote: number;
  mediaFotosPorSessao: number;
}

interface Options {
  year: number;
  month?: number; // undefined = ano cheio
  categoria?: string | null;
  enabled?: boolean;
}

async function fetchOne(
  userId: string,
  year: number,
  month: number,
  categoria: string | null,
): Promise<CachedPhotoProduction | null> {
  const cached = photoProductionCache.getSync(userId, year, month, categoria);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data, error } = await supabase.rpc("workflow_photo_production_month", {
    p_user_id: userId,
    p_start: start,
    p_end: end,
    p_categoria: categoria,
  });
  if (error) return cached;
  const row: any = Array.isArray(data) ? data[0] : data;
  const n = (v: unknown) => Number(v) || 0;
  const parsed: CachedPhotoProduction = {
    fotosIncluidas: Math.round(n(row?.fotos_incluidas)),
    fotosExtras: Math.round(n(row?.fotos_extras)),
    fotosTotal: Math.round(n(row?.fotos_total)),
    sessoesComPacote: Math.round(n(row?.sessoes_com_pacote)),
    sessoesSemPacote: Math.round(n(row?.sessoes_sem_pacote)),
    mediaFotosPorSessao: n(row?.media_fotos_por_sessao),
    categoriaTop: (row?.categoria_top ?? null) as string | null,
    fotosCategoriaTop: Math.round(n(row?.fotos_categoria_top)),
  };
  photoProductionCache.set(userId, year, month, parsed, categoria);
  return parsed;
}

export function useWorkflowPhotoProduction(opts: Options) {
  const { year, month, categoria = null, enabled = true } = opts;
  const [userId, setUserId] = useState<string | null>(null);
  const [byMonth, setByMonth] = useState<Record<number, CachedPhotoProduction | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const currentKey = useRef<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;
    const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1);
    const cat = categoria ?? null;
    const key = `${userId}:${year}:${cat ?? ""}:${month ?? "all"}`;
    currentKey.current = key;

    // Semear com cache síncrono para UX imediata
    const seeded: Record<number, CachedPhotoProduction | null> = {};
    let allCached = true;
    for (const m of months) {
      const c = photoProductionCache.getSync(userId, year, m, cat);
      seeded[m] = c;
      if (!c) allCached = false;
    }
    setByMonth(seeded);
    setIsLoading(!allCached);

    let cancelled = false;
    const revalidate = async () => {
      const results = await Promise.all(
        months.map(async (m) => [m, await fetchOne(userId, year, m, cat)] as const),
      );
      if (cancelled || currentKey.current !== key) return;
      const next: Record<number, CachedPhotoProduction | null> = {};
      for (const [m, v] of results) next[m] = v;
      setByMonth(next);
      setIsLoading(false);
    };
    void revalidate();

    // Reagir a alterações no funil
    const reload = () => {
      months.forEach((m) => photoProductionCache.invalidate(userId, year, m, cat));
      void revalidate();
    };
    const offs = [
      eventBus.on("workflow.card_updated", reload),
      eventBus.on("workflow.card_advanced", reload),
      eventBus.on("workflow.card_deleted", reload),
      eventBus.on("workflow.payment_attached", reload),
      eventBus.on("workflow.payment_added", reload),
      eventBus.on("workflow.payment_refunded", reload),
      eventBus.on("workflow.produto_added", reload),
      eventBus.on("workflow.produto_removed", reload),
    ];
    const onWinReload = () => reload();
    window.addEventListener("workflow-session-updated", onWinReload);
    window.addEventListener("workflow-session-deleted", onWinReload);

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      window.removeEventListener("workflow-session-updated", onWinReload);
      window.removeEventListener("workflow-session-deleted", onWinReload);
    };
  }, [enabled, userId, year, month, categoria]);

  const monthly = useMemo<MonthlyPhotoProduction[]>(() => {
    const out: MonthlyPhotoProduction[] = [];
    for (let m = 1; m <= 12; m++) {
      const v = byMonth[m];
      out.push({
        month: m,
        fotosIncluidas: v?.fotosIncluidas ?? 0,
        fotosExtras: v?.fotosExtras ?? 0,
        fotosTotal: v?.fotosTotal ?? 0,
        sessoesComPacote: v?.sessoesComPacote ?? 0,
        sessoesSemPacote: v?.sessoesSemPacote ?? 0,
        mediaFotosPorSessao: v?.mediaFotosPorSessao ?? 0,
        categoriaTop: v?.categoriaTop ?? null,
        fotosCategoriaTop: v?.fotosCategoriaTop ?? 0,
      });
    }
    return out;
  }, [byMonth]);

  const annual = useMemo<AnnualPhotoProduction>(() => {
    const acc = { fotosIncluidas: 0, fotosExtras: 0, fotosTotal: 0, sessoesComPacote: 0, sessoesSemPacote: 0, mediaSum: 0, mediaN: 0 };
    for (const m of monthly) {
      acc.fotosIncluidas += m.fotosIncluidas;
      acc.fotosExtras += m.fotosExtras;
      acc.fotosTotal += m.fotosTotal;
      acc.sessoesComPacote += m.sessoesComPacote;
      acc.sessoesSemPacote += m.sessoesSemPacote;
      const nSess = m.sessoesComPacote + m.sessoesSemPacote;
      if (nSess > 0) {
        acc.mediaSum += m.mediaFotosPorSessao * nSess;
        acc.mediaN += nSess;
      }
    }
    return {
      fotosIncluidas: acc.fotosIncluidas,
      fotosExtras: acc.fotosExtras,
      fotosTotal: acc.fotosTotal,
      sessoesComPacote: acc.sessoesComPacote,
      sessoesSemPacote: acc.sessoesSemPacote,
      mediaFotosPorSessao: acc.mediaN > 0 ? Math.round((acc.mediaSum / acc.mediaN) * 100) / 100 : 0,
    };
  }, [monthly]);

  const single = month ? monthly[month - 1] : null;

  return { monthly, annual, single, isLoading };
}

/** Helper avulso — usar em contextos non-React (ex.: ferramenta da IA). */
export async function runPhotoProductionForMonth(year: number, month: number, categoria?: string | null) {
  return execute("workflow.photoProductionForMonth", { year, month, categoria: categoria ?? null });
}
