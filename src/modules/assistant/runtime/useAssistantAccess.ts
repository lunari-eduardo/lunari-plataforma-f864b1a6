import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A6 — Gate de rollout da Lu.
 *
 * Consulta a RPC `assistant_access_allowed` que decide se o usuário atual
 * pode ver / usar a assistente Lu conforme o estágio ativo em
 * `app_settings.assistant_rollout_stage` (admin | beta | geral).
 *
 * A regra é fail-closed: qualquer erro/timeout devolve `false` para que
 * o launcher some ao invés de aparecer quebrado.
 */
export type AssistantRolloutStage = "admin" | "beta" | "geral";

export type AssistantAccessReason = "allowed" | "admin_only" | "beta_only" | "unknown";

interface AccessState {
  allowed: boolean;
  stage: AssistantRolloutStage | null;
  reason: AssistantAccessReason;
}

export const ASSISTANT_ACCESS_QUERY_KEY = ["assistant", "access-allowed"] as const;

export function useAssistantAccess() {
  const query = useQuery({
    queryKey: ASSISTANT_ACCESS_QUERY_KEY,
    queryFn: async (): Promise<AccessState> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return { allowed: false, stage: null, reason: "unknown" };

      const [{ data, error }, stageRes] = await Promise.all([
        supabase.rpc("assistant_access_allowed", { _uid: uid }),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "assistant_rollout_stage")
          .maybeSingle(),
      ]);

      const rawStage = (stageRes?.data as { value?: unknown } | null)?.value;
      const stage =
        rawStage === "admin" || rawStage === "beta" || rawStage === "geral"
          ? (rawStage as AssistantRolloutStage)
          : null;

      const allowed = !error && data === true;
      const reason: AssistantAccessReason = allowed
        ? "allowed"
        : stage === "admin"
          ? "admin_only"
          : stage === "beta"
            ? "beta_only"
            : "unknown";

      return { allowed, stage, reason };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    allowed: query.data?.allowed === true,
    stage: query.data?.stage ?? null,
    reason: query.data?.reason ?? "unknown",
    isLoading: query.isLoading,
  };
}
