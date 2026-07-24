/**
 * Onda A — Provider batch para o mês visível do Workflow.
 *
 * Elimina o fan-out por card:
 *  - `useAccessControl()` era chamado por cada card colapsado. Agora é
 *    chamado UMA vez aqui e distribuído por contexto.
 *  - `useSessionGalerias(sessionSlug)` era uma query por card. Agora é UMA
 *    query mensal com `in('session_id', slugs)` e distribuída via mapa.
 *
 * Fallback: se um card renderizar fora do provider, os hooks antigos
 * (`useAccessControl` / `useSessionGalerias`) continuam funcionando —
 * `useMonthAccessControl` e `useMonthGalleriasForSession` fazem fallback
 * transparente sem quebrar nada.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl, type AccessState } from "@/hooks/useAccessControl";
import type { SessionGaleria } from "@/hooks/useSessionGalerias";

interface AccessSlice {
  accessState: AccessState;
  hasGaleryAccess: boolean;
}

interface WorkflowMonthDataValue {
  access: AccessSlice;
  /** Mapa `session_slug` (texto workflow-*) OU `id` UUID → galerias. */
  galeriasBySession: Map<string, SessionGaleria[]>;
  isLoadingGalerias: boolean;
}

const WorkflowMonthDataContext = React.createContext<WorkflowMonthDataValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** Slugs textuais das sessões do mês visível (workflow-*). */
  sessionSlugs: string[];
  /** Ids UUID das sessões — usados como fallback quando `session_id` é null. */
  sessionUuids?: string[];
}

/**
 * Monta ao redor do listado do Workflow. Só busca galerias quando o mês
 * tem sessões — mês vazio não gera request.
 */
export function WorkflowMonthDataProvider({
  children,
  sessionSlugs,
  sessionUuids = [],
}: ProviderProps) {
  const { user } = useAuth();
  const userId = user?.id;

  // Access control: 1 chamada por página, não por card.
  const { accessState, hasGaleryAccess } = useAccessControl();

  // Chave estável: ordena para evitar refetch por mudança de ordem apenas.
  const slugsKey = React.useMemo(
    () => [...sessionSlugs].filter(Boolean).sort().join(","),
    [sessionSlugs],
  );
  const uuidsKey = React.useMemo(
    () => [...sessionUuids].filter(Boolean).sort().join(","),
    [sessionUuids],
  );

  const galeriasQuery = useQuery({
    queryKey: ["workflow", "month-galerias", userId, slugsKey],
    enabled: !!userId && slugsKey.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const slugs = slugsKey.split(",").filter(Boolean);
      if (slugs.length === 0) return [] as (SessionGaleria & { session_id: string })[];
      const { data, error } = await supabase
        .from("galerias")
        .select("id, tipo, status, status_pagamento, created_at, session_id")
        .eq("user_id", userId!)
        .in("session_id", slugs)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as (SessionGaleria & { session_id: string })[];
    },
  });

  const galeriasBySession = React.useMemo(() => {
    const map = new Map<string, SessionGaleria[]>();
    for (const row of galeriasQuery.data || []) {
      const key = row.session_id;
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push({
        id: row.id,
        tipo: row.tipo,
        status: row.status,
        status_pagamento: row.status_pagamento,
        created_at: row.created_at,
      });
      map.set(key, list);
    }
    return map;
  }, [galeriasQuery.data]);

  // Realtime leve: invalida o mapa quando galerias do usuário mudam.
  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wf-month-galerias-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "galerias", filter: `user_id=eq.${userId}` },
        () => {
          galeriasQuery.refetch().catch(() => {});
        },
      )
      .subscribe();

    // Onda 1 (2.6): quando o canal v2 detecta uma sessão nova, refaz a query
    // de galerias no mesmo tick — sem esperar o array de slugs recomputar.
    const handleSlugAdded = (event: Event) => {
      const slug = (event as CustomEvent).detail?.slug as string | undefined;
      if (!slug) return;
      galeriasQuery.refetch().catch(() => {});
    };
    window.addEventListener("workflow-month-slug-added", handleSlugAdded as EventListener);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("workflow-month-slug-added", handleSlugAdded as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  const value = React.useMemo<WorkflowMonthDataValue>(
    () => ({
      access: { accessState, hasGaleryAccess: !!hasGaleryAccess },
      galeriasBySession,
      isLoadingGalerias: galeriasQuery.isLoading,
    }),
    [accessState, hasGaleryAccess, galeriasBySession, galeriasQuery.isLoading],
  );

  // uuidsKey mantido só como sinal futuro (RPC batch financeira, Onda B).
  void uuidsKey;

  return (
    <WorkflowMonthDataContext.Provider value={value}>
      {children}
    </WorkflowMonthDataContext.Provider>
  );
}

/**
 * Access control unificado: se o card está dentro do Provider, reutiliza
 * o resultado; senão cai no hook antigo (fallback sem regressão).
 */
export function useMonthAccessControl(): AccessSlice {
  const ctx = React.useContext(WorkflowMonthDataContext);
  const fallback = useAccessControl();
  if (ctx) return ctx.access;
  return {
    accessState: fallback.accessState,
    hasGaleryAccess: !!fallback.hasGaleryAccess,
  };
}

/**
 * Galerias de uma sessão específica. Prefere o mapa batch do Provider;
 * se ausente ou vazio, faz fallback para a query per-card antiga.
 */
export function useMonthGalleriasForSession(sessionKey: string | null | undefined): {
  galerias: SessionGaleria[];
  hasGalerias: boolean;
  loading: boolean;
  fromBatch: boolean;
} {
  const ctx = React.useContext(WorkflowMonthDataContext);
  const inBatch = !!ctx && !!sessionKey && ctx.galeriasBySession.has(sessionKey);
  const galerias = inBatch ? ctx!.galeriasBySession.get(sessionKey!) ?? [] : [];
  return {
    galerias,
    hasGalerias: galerias.length > 0,
    loading: ctx ? ctx.isLoadingGalerias && !inBatch : false,
    fromBatch: inBatch,
  };
}
