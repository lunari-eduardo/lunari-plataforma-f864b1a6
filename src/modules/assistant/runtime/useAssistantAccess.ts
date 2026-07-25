import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Onda G — Gate de rollout da Lu.
 *
 * Consulta a RPC `assistant_access_allowed` que decide se o usuário atual
 * pode ver / usar a assistente Lu conforme o estágio ativo em
 * `app_settings.assistant_rollout_stage` (admin | beta | geral).
 *
 * A regra é fail-closed: qualquer erro/timeout devolve `false` para que
 * o launcher some ao invés de aparecer quebrado.
 */
export type AssistantRolloutStage = "admin" | "beta" | "geral";

export function useAssistantAccess() {
  const query = useQuery({
    queryKey: ["assistant", "access-allowed"],
    queryFn: async (): Promise<boolean> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc("assistant_access_allowed", {
        _uid: uid,
      });
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    allowed: query.data === true,
    isLoading: query.isLoading,
  };
}
