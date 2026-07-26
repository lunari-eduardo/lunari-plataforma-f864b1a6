/**
 * React hook para consumir Context Engine v1 na UI.
 * Usa TanStack Query para cache/refetch; invalida sob demanda via
 * `invalidateContext(userId)` + `queryClient.invalidateQueries(['context', userId])`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadContext, invalidateContext, type ContextSnapshot } from ".";

export function useContextSnapshot(userId: string | null | undefined) {
  const qc = useQueryClient();
  return {
    ...useQuery<ContextSnapshot>({
      queryKey: ["context", userId ?? "anonymous"],
      queryFn: () => loadContext(userId ?? ""),
      enabled: !!userId,
      staleTime: 60_000,
    }),
    invalidate: () => {
      if (userId) invalidateContext(userId);
      qc.invalidateQueries({ queryKey: ["context", userId ?? "anonymous"] });
    },
  };
}
